import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const codes = await prisma.btwCode.findMany({ orderBy: { code: 'asc' } })
  return NextResponse.json(codes)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const code = await prisma.btwCode.create({
      data: {
        code: body.code,
        description: body.description,
        percentage: body.percentage ?? null,
      }
    })
    return NextResponse.json(code, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Code bestaat al' }, { status: 409 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
