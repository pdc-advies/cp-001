import { prisma } from '@/lib/prisma'
import { invoiceIdFromExternal } from '@/lib/server/messages'

// Ontvangt een statusmelding van Unit4 (geboekt of betaald) en werkt de factuur in CP-001 bij.
// Gebruikt door de route POST /api/interface/unit4/invoice-status en door de Unit4-simulatie zelf.
export async function applyStatusUpdate(update) {
  const id = invoiceIdFromExternal(update?.externalId)
  const invoice = id && (await prisma.invoice.findFirst({ where: { id } }))
  if (!invoice) return { status: 404, body: { error: `Onbekende factuur ${update?.externalId ?? ''}`.trim() } }

  if (update.status === 'booked' && invoice.status === 'verzonden') {
    await prisma.invoice.update({
      where: { id },
      data: { status: 'geboekt', unit4Number: update.unit4InvoiceNumber, bookedAt: new Date(update.bookedAt), bookedBy: update.bookedBy ?? null },
    })
  } else if (update.status === 'paid' && invoice.status === 'geboekt') {
    await prisma.invoice.update({ where: { id }, data: { status: 'betaald', paidAt: new Date(update.paidAt) } })
  } else {
    return { status: 409, body: { error: `Status '${update.status}' past niet bij factuurstatus '${invoice.status}'` } }
  }
  return { status: 200, body: { ok: true, externalId: update.externalId } }
}
