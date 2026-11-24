import { NextResponse } from 'next/server'
import { globalSearch } from '@/lib/server/globalSearch'

export const dynamic = 'force-dynamic'

// GET /api/search?q=...&limit=8 → { query, groups: [{ key, label, total, items: [{ title, subtitle, notes, href }] }] }
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(searchParams.get('limit')) || 8, 200)
  if (!q) return NextResponse.json({ query: '', groups: [] })
  try {
    return NextResponse.json(await globalSearch(q, { limit }))
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
