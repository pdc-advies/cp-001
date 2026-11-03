import { NextResponse } from 'next/server'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'
import { createRun, runPreview } from '@/lib/server/invoices'

export const dynamic = 'force-dynamic'

// Voorstel voor een factuurrun: ?frequency=Kwartaal&year=2026&index=0
export async function GET(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const q = new URL(request.url).searchParams
    const result = await runPreview(q.get('frequency'), q.get('year'), q.get('index'))
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Maakt de concepten voor alle contracten die gereed zijn: { frequency, year, index }
export async function POST(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const { frequency, year, index } = await request.json()
    const result = await createRun(frequency, year, index, author(request))
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
