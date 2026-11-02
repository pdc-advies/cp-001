import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'

// Stappen: aangemaakt (CP-001) → verzonden (naar Unit4) → geboekt (in Unit4, krijgt daar het factuurnummer)
export async function PATCH(request, { params }) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const id = parseInt((await params).id)
    const { action } = await request.json()
    const invoice = await prisma.invoice.findFirst({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 })

    let data
    if (action === 'send' && invoice.status === 'aangemaakt') {
      data = { status: 'verzonden', sentAt: new Date() }
    } else if (action === 'book' && invoice.status === 'verzonden') {
      const bookedAt = new Date()
      const number = `U4-${bookedAt.getUTCFullYear()}-${String(invoice.id).padStart(5, '0')}`
      data = { status: 'geboekt', bookedAt, bookedBy: author(request), unit4Number: number }
    } else {
      return NextResponse.json({ error: `Stap '${action}' kan niet bij status '${invoice.status}'` }, { status: 400 })
    }
    return NextResponse.json(await prisma.invoice.update({ where: { id }, data }))
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const id = parseInt((await params).id)
    const invoice = await prisma.invoice.findFirst({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 })
    if (invoice.status === 'geboekt') return NextResponse.json({ error: 'Een geboekte factuur kan niet verwijderd worden' }, { status: 400 })
    if (invoice.creditOfId) return NextResponse.json({ error: 'Een creditfactuur kan niet verwijderd worden' }, { status: 400 })
    await prisma.invoice.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
