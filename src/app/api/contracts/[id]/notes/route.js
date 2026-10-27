import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TEAMS } from '@/lib/teams'
import { author } from '@/lib/authUser'

export const dynamic = 'force-dynamic'

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
    const body = await request.json()
    const text = String(body.text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'Notitie is leeg' }, { status: 400 })
    const team = body.team || null
    if (team && !TEAMS[team]) return NextResponse.json({ error: 'Onbekend team' }, { status: 400 })
    const note = await prisma.contractNote.create({ data: { contractId, text, team, author: author(request) } })
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    if (err.code === 'P2003') {
      return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
