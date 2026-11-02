import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'
import { buildInvoice, periodsFor } from '@/lib/invoicing'

export const dynamic = 'force-dynamic'

const day = (d) => (d ? d.toISOString().slice(0, 10) : null)

export async function GET() {
  if (!isDemo()) return new Response(null, { status: 404 })
  const invoices = await prisma.invoice.findMany({ orderBy: { id: 'desc' } })
  return NextResponse.json(invoices)
}

// Maakt de factuur altijd uit de opgeslagen contractgegevens, niet uit wat het scherm meestuurt
export async function POST(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const { contractId, year, index } = await request.json()
    const contract = await prisma.contract.findFirst({ where: { id: parseInt(contractId) } })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })
    if (contract.status === 'draft') return NextResponse.json({ error: 'Een conceptcontract kan niet gefactureerd worden' }, { status: 400 })

    const period = periodsFor(contract.invoiceFrequency, Number(year))[Number(index)]
    if (!period) return NextResponse.json({ error: 'Geen geldige periode of frequentie' }, { status: 400 })

    const overlap = await prisma.invoice.findFirst({
      where: { contractId: contract.id, periodStart: { lte: new Date(period.end) }, periodEnd: { gte: new Date(period.start) } },
    })
    if (overlap) return NextResponse.json({ error: `Deze periode is al gefactureerd (${overlap.periodLabel})` }, { status: 409 })

    const btw = contract.btwCode ? await prisma.btwCode.findUnique({ where: { code: contract.btwCode } }) : null
    const customer = contract.debiteurnummer ? await prisma.customer.findFirst({ where: { debiteurnummer: contract.debiteurnummer } }) : null
    const result = buildInvoice(
      {
        ...contract,
        startDate: day(contract.startDate),
        endDate: day(contract.endDate),
        invoiceStartDate: day(contract.invoiceStartDate),
        invoiceEndDate: day(contract.invoiceEndDate),
      },
      period,
      btw?.percentage
    )
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    const invoice = await prisma.invoice.create({
      data: {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        debiteurnummer: contract.debiteurnummer,
        customerName: customer?.name ?? contract.customerName,
        frequency: contract.invoiceFrequency,
        periodLabel: period.label,
        periodStart: new Date(period.start),
        periodEnd: new Date(period.end),
        lines: result.lines,
        subtotal: result.subtotal,
        vatAmount: result.vatAmount,
        total: result.total,
        createdBy: author(request),
      },
    })
    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
