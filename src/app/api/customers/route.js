import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const customers = await prisma.customer.findMany({ orderBy: { debiteurnummer: 'asc' } })
  return NextResponse.json(customers)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const customer = await prisma.customer.create({
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
    return NextResponse.json(customer, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Debiteurnummer bestaat al' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
