import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'

export const dynamic = 'force-dynamic'

// Logboek van de koppeling; ?invoiceId= voor één factuur
export async function GET(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  const invoiceId = Number(new URL(request.url).searchParams.get('invoiceId')) || undefined
  return NextResponse.json(await prisma.interfaceMessage.findMany({ where: { invoiceId }, orderBy: { id: 'desc' }, take: 500 }))
}
