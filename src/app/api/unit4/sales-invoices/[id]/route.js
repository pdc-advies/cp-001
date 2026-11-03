import { NextResponse } from 'next/server'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'
import { bookSalesInvoice, paySalesInvoice } from '@/lib/server/unit4'

// Unit4-simulatie: boeken ({ action: 'book' }) of betaling registreren ({ action: 'pay' }); beide melden terug aan CP-001
export async function PATCH(request, { params }) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const id = parseInt((await params).id)
    const { action } = await request.json()
    const handler = { book: bookSalesInvoice, pay: paySalesInvoice }[action]
    if (!handler) return NextResponse.json({ error: `Onbekende stap '${action}'` }, { status: 400 })
    const result = await handler(id, author(request))
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
