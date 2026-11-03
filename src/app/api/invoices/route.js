import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { author } from '@/lib/authUser'
import { isDemo } from '@/lib/demo'
import { createContractInvoice, createTaxInvoice } from '@/lib/server/invoices'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  const contractId = Number(new URL(request.url).searchParams.get('contractId')) || undefined
  const invoices = await prisma.invoice.findMany({ where: { contractId }, orderBy: { id: 'desc' } })
  return NextResponse.json(invoices)
}

// Eén factuur: { contractId, year, index } voor een contractperiode, of { type: 'belasting', ... } voor een aanslag
export async function POST(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const body = await request.json()
    const contract = await prisma.contract.findFirst({ where: { id: parseInt(body.contractId) } })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })
    const result = body.type === 'belasting'
      ? await createTaxInvoice(contract, body, author(request))
      : await createContractInvoice(contract, body.year, body.index, author(request))
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
