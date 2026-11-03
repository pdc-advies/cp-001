import { NextResponse } from 'next/server'
import { isDemo } from '@/lib/demo'
import { RICHTING, ENDPOINTS, logMessage, invoiceIdFromExternal } from '@/lib/server/messages'
import { applyStatusUpdate } from '@/lib/server/statusCallback'

// Statuskoppeling van CP-001: Unit4 meldt hier dat een factuur geboekt of betaald is
export async function POST(request) {
  if (!isDemo()) return new Response(null, { status: 404 })
  try {
    const payload = await request.json()
    const result = await applyStatusUpdate(payload)
    await logMessage({
      invoiceId: invoiceIdFromExternal(payload?.externalId),
      direction: RICHTING.naarCp001,
      operation: payload?.status === 'paid' ? 'Betaling gemeld' : 'Boeking gemeld',
      method: 'POST',
      endpoint: ENDPOINTS.statusCallback,
      payload,
      response: result.body,
      httpStatus: result.status,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
