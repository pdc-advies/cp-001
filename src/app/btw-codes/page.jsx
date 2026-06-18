import { prisma } from '@/lib/prisma'
import BtwCodesClient from '@/components/BtwCodesClient'

export const dynamic = 'force-dynamic'

export default async function BtwCodesPage() {
  let codes = []
  try {
    codes = await prisma.btwCode.findMany({ orderBy: { code: 'asc' } })
  } catch {}
  return <BtwCodesClient initialCodes={codes} />
}
