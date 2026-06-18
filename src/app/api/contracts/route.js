import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const contracts = await prisma.contract.findMany({
    orderBy: { id: 'desc' }
  })
  return NextResponse.json(contracts)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const contract = await prisma.contract.create({
      data: {
        contractNumber: body.contractNumber,
        customerName: body.customerName,
        kostenplaats: body.kostenplaats ?? null,
        description: body.description ?? null,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        contractValue: body.contractValue ?? null,
        m2: body.m2 ?? null,
        pricePerM2: body.pricePerM2 ?? null,
        priceIndex: body.priceIndex ?? null,
        basePricePerM2: body.basePricePerM2 ?? null,
        baseIndexYear: body.baseIndexYear ?? null,
        indexSeries: body.indexSeries ?? null,
        contractType: body.contractType ?? null,
        invoiceFrequency: body.invoiceFrequency ?? null,
        manager: body.manager ?? null,
        invoiceStartDate: body.invoiceStartDate ? new Date(body.invoiceStartDate) : null,
        invoiceEndDate: body.invoiceEndDate ? new Date(body.invoiceEndDate) : null,
        debiteurnummer: body.debiteurnummer ?? null,
        kadastrale: body.kadastrale ?? null,
        grootboekNieuw: body.grootboekNieuw ?? null,
        btwCode: body.btwCode ?? null,
        invoiceRef: body.invoiceRef ?? null,
        status: body.status || 'draft',
        notes: body.notes ?? null
      }
    })
    return NextResponse.json(contract, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { count } = await prisma.contract.deleteMany()
    return NextResponse.json({ deleted: count })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
