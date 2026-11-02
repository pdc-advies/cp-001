import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'
import { BELASTINGEN, buildInvoice, buildTaxInvoice, creditLines, periodsFor } from '@/lib/invoicing'

export const dynamic = 'force-dynamic'

const day = (d) => (d ? d.toISOString().slice(0, 10) : null)

export async function GET() {
  if (!isDemo()) return new Response(null, { status: 404 })
  const invoices = await prisma.invoice.findMany({ orderBy: { id: 'desc' } })
  return NextResponse.json(invoices)
}

const contractDates = (c) => ({
  ...c,
  startDate: day(c.startDate),
  endDate: day(c.endDate),
  invoiceStartDate: day(c.invoiceStartDate),
  invoiceEndDate: day(c.invoiceEndDate),
})

async function createTaxInvoice(request, contract, base, body) {
  const { taxType, reference } = body
  const taxYear = Number(body.taxYear)
  const received = new Date(body.receivedAt)
  if (isNaN(received)) return NextResponse.json({ error: 'Vul de ontvangstdatum van de aanslag in' }, { status: 400 })

  // Per aanslagjaar telt één lopende factuur; een correctie vervangt een geboekte factuur
  const bestaand = await prisma.invoice.findFirst({
    where: { contractId: contract.id, type: 'belasting', taxType, taxYear, creditOfId: null, credited: false },
  })
  const corrigeert = body.corrects != null
  if (bestaand && !corrigeert) return NextResponse.json({ error: `Aanslagjaar ${taxYear} is al doorbelast` }, { status: 409 })
  if (corrigeert && bestaand?.id !== Number(body.corrects)) {
    return NextResponse.json({ error: 'Deze factuur kan niet meer gecorrigeerd worden' }, { status: 400 })
  }
  if (corrigeert && bestaand.status !== 'geboekt') {
    return NextResponse.json({ error: 'Alleen een geboekte factuur wordt gecorrigeerd; verwijder deze factuur anders' }, { status: 400 })
  }

  const result = buildTaxInvoice(contractDates(contract), { taxType, year: taxYear, amount: body.amount }, base.btwPercentage)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  if (corrigeert && result.subtotal === bestaand.subtotal) {
    return NextResponse.json({ error: 'Het bedrag is gelijk aan de bestaande factuur' }, { status: 400 })
  }

  const data = {
    ...base.data,
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
  if (!corrigeert) return NextResponse.json(await prisma.invoice.create({ data }), { status: 201 })

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
  return NextResponse.json(invoice, { status: 201 })
}

// Contractfacturen komen altijd uit de opgeslagen contractgegevens; belastingfacturen uit de ontvangen aanslag
export async function POST(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const body = await request.json()
    const { contractId, year, index } = body
    const contract = await prisma.contract.findFirst({ where: { id: parseInt(contractId) } })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })
    if (contract.status === 'draft') return NextResponse.json({ error: 'Een conceptcontract kan niet gefactureerd worden' }, { status: 400 })

    const btw = contract.btwCode ? await prisma.btwCode.findUnique({ where: { code: contract.btwCode } }) : null
    const customer = contract.debiteurnummer ? await prisma.customer.findFirst({ where: { debiteurnummer: contract.debiteurnummer } }) : null
    const base = {
      btwPercentage: btw?.percentage,
      data: {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        debiteurnummer: contract.debiteurnummer,
        customerName: customer?.name ?? contract.customerName,
        createdBy: author(request),
      },
    }
    if (body.type === 'belasting') return await createTaxInvoice(request, contract, base, body)

    const period = periodsFor(contract.invoiceFrequency, Number(year))[Number(index)]
    if (!period) return NextResponse.json({ error: 'Geen geldige periode of frequentie' }, { status: 400 })

    const overlap = await prisma.invoice.findFirst({
      where: { contractId: contract.id, type: 'contract', periodStart: { lte: new Date(period.end) }, periodEnd: { gte: new Date(period.start) } },
    })
    if (overlap) return NextResponse.json({ error: `Deze periode is al gefactureerd (${overlap.periodLabel})` }, { status: 409 })

    const result = buildInvoice(contractDates(contract), period, base.btwPercentage)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    const invoice = await prisma.invoice.create({
      data: {
        ...base.data,
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
    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
