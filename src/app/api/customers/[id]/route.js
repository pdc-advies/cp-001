import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request, { params }) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        debiteurnummer: body.debiteurnummer,
        debiteurnummerOud: body.debiteurnummerOud ?? null,
        name: body.name,
        address: body.address ?? null,
        city: body.city ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        notes: body.notes ?? null,
      }
    })
    return NextResponse.json(customer)
  } catch (err) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Debiteurnummer bestaat al' }, { status: 409 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id)
    await prisma.customer.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
