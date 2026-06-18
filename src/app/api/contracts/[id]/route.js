import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request, { params }) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const contract = await prisma.contract.update({
      where: { id },
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
        status: body.status || 'draft',
        notes: body.notes ?? null
      }
    })
    return NextResponse.json(contract)
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id)
    await prisma.contract.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
