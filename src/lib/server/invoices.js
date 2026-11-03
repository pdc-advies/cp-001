import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { BELASTINGEN, BETAALTERMIJN_DAGEN, FREQUENTIES, buildInvoice, buildTaxInvoice, creditLines, periodsFor } from '@/lib/invoicing'
import { ENDPOINTS, RICHTING, externalId, logMessage } from '@/lib/server/messages'
import { receiveSalesInvoice } from '@/lib/server/unit4'

// Factuurlogica van CP-001: concepten maken (per periode of per ontvangen aanslag) en versturen naar Unit4.

const day = (d) => (d ? d.toISOString().slice(0, 10) : null)
const fail = (status, error) => ({ status, body: { error } })

export const contractDates = (c) => ({
  ...c,
  startDate: day(c.startDate),
  endDate: day(c.endDate),
  invoiceStartDate: day(c.invoiceStartDate),
  invoiceEndDate: day(c.invoiceEndDate),
})

async function basis(contract, user) {
  const [btw, customer] = await Promise.all([
    contract.btwCode ? prisma.btwCode.findUnique({ where: { code: contract.btwCode } }) : null,
    contract.debiteurnummer ? prisma.customer.findFirst({ where: { debiteurnummer: contract.debiteurnummer } }) : null,
  ])
  return {
    btwPercentage: btw?.percentage,
    data: {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      debiteurnummer: contract.debiteurnummer,
      customerName: customer?.name ?? contract.customerName,
      createdBy: user,
    },
  }
}

const overlappend = (contractId, period) =>
  prisma.invoice.findFirst({
    where: { contractId, type: 'contract', periodStart: { lte: new Date(period.end) }, periodEnd: { gte: new Date(period.start) } },
  })

// Contractfactuur voor één periode van de frequentie op het contract
export async function createContractInvoice(contract, year, index, user, runKey = null) {
  if (contract.status === 'draft') return fail(400, 'Een conceptcontract wordt niet gefactureerd')
  const period = periodsFor(contract.invoiceFrequency, Number(year))[Number(index)]
  if (!period) return fail(400, 'Geen factuurfrequentie op het contract, of ongeldige periode')
  const overlap = await overlappend(contract.id, period)
  if (overlap) return fail(409, `Deze periode is al gefactureerd (${overlap.periodLabel})`)

  const b = await basis(contract, user)
  const result = buildInvoice(contractDates(contract), period, b.btwPercentage)
  if (result.error) return fail(400, result.error)
  const invoice = await prisma.invoice.create({
    data: {
      ...b.data,
      runKey,
      customerReference: result.referentie,
      frequency: contract.invoiceFrequency,
      periodLabel: period.label,
      periodStart: new Date(period.start),
      periodEnd: new Date(period.end),
      lines: result.lines,
      subtotal: result.subtotal,
      vatAmount: result.vatAmount,
      total: result.total,
    },
  })
  return { status: 201, body: invoice }
}

// Belastingfactuur voor een ontvangen aanslag; met body.corrects een creditfactuur plus nieuwe factuur
export async function createTaxInvoice(contract, body, user) {
  if (contract.status === 'draft') return fail(400, 'Een conceptcontract wordt niet gefactureerd')
  const { taxType, reference } = body
  const taxYear = Number(body.taxYear)
  const received = new Date(body.receivedAt)
  if (!BELASTINGEN[taxType]) return fail(400, 'Onbekende belasting')
  if (isNaN(received)) return fail(400, 'Vul de ontvangstdatum van de aanslag in')

  // Per aanslagjaar telt één lopende factuur; een correctie vervangt een geboekte of betaalde factuur
  const bestaand = await prisma.invoice.findFirst({
    where: { contractId: contract.id, type: 'belasting', taxType, taxYear, creditOfId: null, credited: false },
  })
  const corrigeert = body.corrects != null
  if (bestaand && !corrigeert) return fail(409, `Aanslagjaar ${taxYear} is al doorbelast`)
  if (corrigeert && bestaand?.id !== Number(body.corrects)) return fail(400, 'Deze factuur kan niet meer gecorrigeerd worden')
  if (corrigeert && !['geboekt', 'betaald'].includes(bestaand.status)) {
    return fail(400, 'Alleen een geboekte factuur wordt gecorrigeerd; verwijder een concept anders')
  }

  const b = await basis(contract, user)
  const result = buildTaxInvoice(contractDates(contract), { taxType, year: taxYear, amount: body.amount }, b.btwPercentage)
  if (result.error) return fail(400, result.error)
  if (corrigeert && result.subtotal === bestaand.subtotal) return fail(400, 'Het bedrag is gelijk aan de bestaande factuur')

  const data = {
    ...b.data,
    type: 'belasting',
    taxType,
    taxYear,
    taxReceivedAt: received,
    taxReference: reference || null,
    frequency: 'Jaar',
    periodLabel: `${BELASTINGEN[taxType].label} ${taxYear}`,
    periodStart: new Date(`${taxYear}-01-01`),
    periodEnd: new Date(`${taxYear}-12-31`),
    lines: result.lines,
    subtotal: result.subtotal,
    vatAmount: result.vatAmount,
    total: result.total,
  }
  if (!corrigeert) return { status: 201, body: await prisma.invoice.create({ data }) }

  const credit = {
    ...data,
    creditOfId: bestaand.id,
    periodLabel: `Credit ${data.periodLabel}`,
    lines: creditLines(bestaand.lines),
    subtotal: -bestaand.subtotal,
    vatAmount: -bestaand.vatAmount,
    total: -bestaand.total,
  }
  const [, , invoice] = await prisma.$transaction([
    prisma.invoice.update({ where: { id: bestaand.id }, data: { credited: true } }),
    prisma.invoice.create({ data: credit }),
    prisma.invoice.create({ data }),
  ])
  return { status: 201, body: invoice }
}

// Het bericht dat CP-001 naar Unit4 stuurt (POST /api/unit4/sales-invoices)
export function salesInvoiceMessage(invoice, contract, { invoiceDate, dueDate }) {
  return {
    messageId: randomUUID(),
    source: 'CP-001',
    sentAt: new Date().toISOString(),
    invoice: {
      externalId: externalId(invoice.id),
      sourceId: invoice.id,
      type: invoice.type,
      creditOf: invoice.creditOfId ? externalId(invoice.creditOfId) : null,
      customerReference: invoice.customerReference,
      invoiceDate,
      dueDate,
      currency: 'EUR',
      customer: { debtorNumber: invoice.debiteurnummer, name: invoice.customerName },
      contract: { number: invoice.contractNumber, type: contract?.contractType ?? null },
      period: { label: invoice.periodLabel, start: day(invoice.periodStart), end: day(invoice.periodEnd) },
      tax: invoice.type === 'belasting'
        ? { type: invoice.taxType, year: invoice.taxYear, receivedAt: day(invoice.taxReceivedAt), reference: invoice.taxReference }
        : null,
      lines: invoice.lines.map((l, n) => ({
        lineNo: n + 1,
        description: l.omschrijving,
        ledgerAccount: l.grootboek,
        costCentre: contract?.kostenplaats ?? null,
        amount: l.bedrag,
        vatCode: contract?.btwCode ?? null,
        vatPercentage: l.btwPct,
        vatAmount: l.btw,
      })),
      totals: { net: invoice.subtotal, vat: invoice.vatAmount, gross: invoice.total },
    },
  }
}

export async function sendInvoice(id, user) {
  const invoice = await prisma.invoice.findFirst({ where: { id } })
  if (!invoice) return fail(404, 'Factuur niet gevonden')
  if (invoice.status !== 'aangemaakt') return fail(400, `Factuur is al ${invoice.status}`)
  const contract = await prisma.contract.findFirst({ where: { id: invoice.contractId } })

  const today = new Date()
  const dates = { invoiceDate: day(today), dueDate: day(new Date(today.getTime() + BETAALTERMIJN_DAGEN * 864e5)) }
  const message = salesInvoiceMessage(invoice, contract, dates)
  const result = await receiveSalesInvoice(message)
  await logMessage({
    invoiceId: invoice.id,
    direction: RICHTING.naarUnit4,
    operation: invoice.creditOfId ? 'Creditfactuur verstuurd' : 'Factuur verstuurd',
    method: 'POST',
    endpoint: ENDPOINTS.salesInvoice,
    payload: message,
    response: result.body,
    httpStatus: result.status,
  })
  if (result.status !== 202) return fail(result.status, result.body.error)
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: 'verzonden', sentAt: today, invoiceDate: new Date(dates.invoiceDate), dueDate: new Date(dates.dueDate) },
  })
  return { status: 200, body: updated }
}

// Factuurrun: welke contracten met deze frequentie in deze periode gefactureerd worden, en waarom niet
export async function runPreview(frequency, year, index) {
  const period = periodsFor(frequency, Number(year))[Number(index)]
  if (!period) return fail(400, 'Ongeldige frequentie of periode')
  const contracts = await prisma.contract.findMany({ where: { invoiceFrequency: frequency }, orderBy: { contractNumber: 'asc' } })
  const btwCodes = Object.fromEntries((await prisma.btwCode.findMany()).map((b) => [b.code, b.percentage]))
  const customers = Object.fromEntries((await prisma.customer.findMany()).map((k) => [k.debiteurnummer, k.name]))
  const rows = []
  for (const c of contracts) {
    const row = { contractId: c.id, contractNumber: c.contractNumber, customerName: customers[c.debiteurnummer] ?? c.customerName }
    const overlap = await overlappend(c.id, period)
    if (overlap) Object.assign(row, { state: 'gefactureerd', reason: `Al gefactureerd: ${overlap.periodLabel}`, invoice: overlap })
    else if (c.status === 'draft') Object.assign(row, { state: 'overgeslagen', reason: 'Conceptcontract' })
    else {
      const result = buildInvoice(contractDates(c), period, btwCodes[c.btwCode])
      Object.assign(row, result.error ? { state: 'overgeslagen', reason: result.error } : { state: 'gereed', total: result.total, subtotal: result.subtotal })
    }
    rows.push(row)
  }
  const zonderFrequentie = await prisma.contract.count({
    where: { OR: [{ invoiceFrequency: null }, { invoiceFrequency: { notIn: Object.keys(FREQUENTIES) } }] },
  })
  return { status: 200, body: { period, runKey: `${frequency}-${year}-${index}`, rows, zonderFrequentie } }
}

export async function createRun(frequency, year, index, user) {
  const preview = await runPreview(frequency, year, index)
  if (preview.status !== 200) return preview
  const runKey = preview.body.runKey
  let created = 0
  for (const row of preview.body.rows.filter((r) => r.state === 'gereed')) {
    const contract = await prisma.contract.findFirst({ where: { id: row.contractId } })
    const result = await createContractInvoice(contract, year, index, user, runKey)
    if (result.status === 201) created++
  }
  return { status: 201, body: { runKey, created } }
}
