import { prisma } from '@/lib/prisma'
import ContractsClient from '@/components/ContractsClient'

export const dynamic = 'force-dynamic'

export default async function ContractsPage() {
  let serialized = []
  try {
    const contracts = await prisma.contract.findMany({
      orderBy: { id: 'desc' }
    })
    serialized = contracts.map(c => ({
      ...c,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt?.toISOString() ?? new Date().toISOString()
    }))
  } catch {
    // DATABASE_URL not set (local dev without DB)
  }

  return <ContractsClient initialContracts={serialized} />
}
