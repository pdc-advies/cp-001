import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'
import { sendInvoice } from '@/lib/server/invoices'

// Versturen naar Unit4 ({ action: 'send' }); boeken en betalen meldt Unit4 zelf via de statuskoppeling
export async function PATCH(request, { params }) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const id = parseInt((await params).id)
    const { action } = await request.json()
    if (action !== 'send') return NextResponse.json({ error: `Onbekende stap '${action}'` }, { status: 400 })
    const result = await sendInvoice(id, author(request))
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Alleen een concept kan weg; wat al naar Unit4 is gegaan, wordt gecorrigeerd met een creditfactuur
export async function DELETE(request, { params }) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const id = parseInt((await params).id)
    const invoice = await prisma.invoice.findFirst({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 })
    if (invoice.status !== 'aangemaakt') return NextResponse.json({ error: 'Alleen een concept kan verwijderd worden' }, { status: 400 })
    if (invoice.creditOfId) return NextResponse.json({ error: 'Een creditfactuur kan niet verwijderd worden' }, { status: 400 })
    await prisma.invoice.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
