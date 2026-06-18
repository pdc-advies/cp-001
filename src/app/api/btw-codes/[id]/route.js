import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request, { params }) {
  try {
    const body = await request.json()
    const code = await prisma.btwCode.update({
      where: { id: parseInt(params.id) },
      data: { code: body.code, description: body.description, percentage: body.percentage ?? null }
    })
    return NextResponse.json(code)
  } catch (err) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Code bestaat al' }, { status: 409 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.btwCode.delete({ where: { id: parseInt(params.id) } })
    return new Response(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
