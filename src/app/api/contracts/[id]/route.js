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
        status: body.status || 'draft',
        notes: body.notes ?? null
      }
    })
    return NextResponse.json(contract)
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Contractnummer bestaat al' }, { status: 409 })
    }
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
