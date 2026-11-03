import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'
import { receiveSalesInvoice } from '@/lib/server/unit4'

export const dynamic = 'force-dynamic'

// Unit4-simulatie. GET: ontvangen verkoopfacturen. POST: verkoopfactuur ontvangen (het endpoint dat CP-001 aanroept).
export async function GET() {
  if (!isDemo()) return new Response(null, { status: 404 })
  return NextResponse.json(await prisma.unit4Invoice.findMany({ orderBy: { id: 'desc' } }))
}

export async function POST(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const result = await receiveSalesInvoice(await request.json())
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
