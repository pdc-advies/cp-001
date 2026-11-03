import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { ENDPOINTS, RICHTING, logMessage } from '@/lib/server/messages'
import { applyStatusUpdate } from '@/lib/server/statusCallback'

// Unit4-simulatie: ontvangt verkoopfacturen, boekt ze, registreert betalingen en meldt dat terug aan CP-001.

export async function receiveSalesInvoice(message) {
  const inv = message?.invoice
  if (!inv?.externalId || !Array.isArray(inv.lines) || !inv.lines.length) {
    return { status: 400, body: { error: 'Bericht onvolledig: externalId en regels zijn verplicht' } }
  }
  const bestaand = await prisma.unit4Invoice.findUnique({ where: { externalId: inv.externalId } })
  if (bestaand) return { status: 409, body: { error: `Factuur ${inv.externalId} is al ontvangen`, unit4Id: bestaand.id } }
  const record = await prisma.unit4Invoice.create({
    data: { externalId: inv.externalId, cp001InvoiceId: inv.sourceId, payload: message },
  })
  return { status: 202, body: { accepted: true, unit4Id: record.id, status: 'ontvangen' } }
}

// Statusmelding naar CP-001, gelogd als bericht van Unit4
async function notify(record, update, operation) {
  const payload = { messageId: randomUUID(), source: 'Unit4', sentAt: new Date().toISOString(), externalId: record.externalId, ...update }
  const result = await applyStatusUpdate(payload)
  await logMessage({
    invoiceId: record.cp001InvoiceId,
    direction: RICHTING.naarCp001,
    operation,
    method: 'POST',
    endpoint: ENDPOINTS.statusCallback,
    payload,
    response: result.body,
    httpStatus: result.status,
  })
  return result
}

export async function bookSalesInvoice(id, user) {
  const record = await prisma.unit4Invoice.findUnique({ where: { id } })
  if (!record) return { status: 404, body: { error: 'Factuur niet gevonden in Unit4' } }
  if (record.status !== 'ontvangen') return { status: 400, body: { error: `Factuur is al ${record.status}` } }
  const bookedAt = new Date()
  const number = `U4-${bookedAt.getUTCFullYear()}-${String(record.id).padStart(5, '0')}`
  const updated = await prisma.unit4Invoice.update({ where: { id }, data: { status: 'geboekt', number, bookedAt, bookedBy: user } })
  await notify(updated, { status: 'booked', unit4InvoiceNumber: number, bookedAt: bookedAt.toISOString(), bookedBy: user }, 'Boeking gemeld')
  return { status: 200, body: updated }
}

export async function paySalesInvoice(id, user) {
  const record = await prisma.unit4Invoice.findUnique({ where: { id } })
  if (!record) return { status: 404, body: { error: 'Factuur niet gevonden in Unit4' } }
  if (record.status !== 'geboekt') return { status: 400, body: { error: 'Alleen een geboekte factuur kan betaald worden' } }
  const paidAt = new Date()
  const updated = await prisma.unit4Invoice.update({ where: { id }, data: { status: 'betaald', paidAt, paidBy: user } })
  await notify(
    updated,
    { status: 'paid', unit4InvoiceNumber: record.number, paidAt: paidAt.toISOString(), amountPaid: record.payload.invoice.totals.gross },
    'Betaling gemeld'
  )
  return { status: 200, body: updated }
}
