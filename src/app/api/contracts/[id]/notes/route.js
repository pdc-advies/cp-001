import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Inlognaam zoals de middleware die meegeeft; nooit uit de body, zodat de auteur niet te vervalsen is
function author(request) {
  const raw = request.headers.get('x-auth-user')
  return raw ? decodeURIComponent(raw) : 'onbekend'
}

export async function GET(request, { params }) {
  try {
    const contractId = parseInt((await params).id)
    const notes = await prisma.contractNote.findMany({ where: { contractId }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(notes)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const contractId = parseInt((await params).id)
    const text = String((await request.json()).text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'Notitie is leeg' }, { status: 400 })
    const note = await prisma.contractNote.create({ data: { contractId, text, author: author(request) } })
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    if (err.code === 'P2003') {
      return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
