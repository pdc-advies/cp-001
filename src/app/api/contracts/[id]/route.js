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
        grootboekNieuw: body.grootboekNieuw ?? null,
        grootboekOud: body.grootboekOud ?? null,
        btwCode: body.btwCode ?? null,
        invoiceRef: body.invoiceRef ?? null,
        fixedPrice: body.fixedPrice ?? false,
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

// Gedeeltelijke update vanuit de kaart: alleen deze velden, de rest blijft ongemoeid
const PATCH_FIELDS = {
  status: (v) => v || 'draft',
  contractType: (v) => v || null,
  startDate: (v) => new Date(v),
  endDate: (v) => (v ? new Date(v) : null),
  m2: (v) => (v === '' || v == null ? null : Number(v)),
  kadastrale: (v) => v || null,
  description: (v) => v || null,
  notes: (v) => v || null,
}

export async function PATCH(request, { params }) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const data = {}
    for (const [field, convert] of Object.entries(PATCH_FIELDS)) {
      if (field in body) data[field] = convert(body[field])
    }
    if ('startDate' in data && isNaN(data.startDate)) {
      return NextResponse.json({ error: 'Startdatum is verplicht' }, { status: 400 })
    }
    if ('m2' in data && data.m2 != null && isNaN(data.m2)) {
      return NextResponse.json({ error: 'm² moet een getal zijn' }, { status: 400 })
    }
    const contract = await prisma.contract.update({ where: { id }, data })
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
