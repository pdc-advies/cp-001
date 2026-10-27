import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { author } from '@/lib/authUser'

// Actie afronden ({ done: true }) of heropenen ({ done: false }); wie en wanneer wordt vastgelegd
export async function PATCH(request, { params }) {
  try {
    const { id, noteId } = await params
    const { done } = await request.json()
    const note = await prisma.contractNote.findFirst({ where: { id: parseInt(noteId), contractId: parseInt(id) } })
    if (!note) return NextResponse.json({ error: 'Notitie niet gevonden' }, { status: 404 })
    if (!note.team) return NextResponse.json({ error: 'Alleen een actie kan worden afgerond' }, { status: 400 })
    const updated = await prisma.contractNote.update({
      where: { id: note.id },
      data: done ? { doneAt: new Date(), doneBy: author(request) } : { doneAt: null, doneBy: null },
    })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
