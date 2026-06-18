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
        status: body.status || 'draft',
        notes: body.notes ?? null
      }
    })
    return NextResponse.json(contract, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Contractnummer bestaat al' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
