import { prisma } from '@/lib/prisma'
import BtwCodesClient from '@/components/BtwCodesClient'

export const dynamic = 'force-dynamic'

export default async function BtwCodesPage() {
  let codes = []
  let usage = {}
  try {
    const [rows, perCode] = await Promise.all([
      prisma.btwCode.findMany({ orderBy: { code: 'asc' } }),
      prisma.contract.groupBy({ by: ['btwCode'], _count: { _all: true } }),
    ])
    codes = rows
    // Aantal contracten per BTW code (ook codes die hier nog niet bestaan, bv. uit de Unit4-import)
    usage = Object.fromEntries(perCode.filter(r => r.btwCode).map(r => [r.btwCode, r._count._all]))
  } catch {}
  return <BtwCodesClient initialCodes={codes} usage={usage} />
}
