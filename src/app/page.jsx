import { prisma } from '@/lib/prisma'
import ContractsClient from '@/components/ContractsClient'

export const dynamic = 'force-dynamic'

export default async function ContractsPage() {
  let serialized = []
  let customers = []
  try {
    const [contracts, rawCustomers] = await Promise.all([
      prisma.contract.findMany({ orderBy: { id: 'desc' } }),
      prisma.customer.findMany({ orderBy: { debiteurnummer: 'asc' } }),
    ])
    const d = v => v instanceof Date ? v.toISOString() : (v ?? null)
    serialized = contracts.map(c => ({
      ...c,
      startDate: d(c.startDate),
      endDate: d(c.endDate),
      invoiceStartDate: d(c.invoiceStartDate),
      invoiceEndDate: d(c.invoiceEndDate),
      createdAt: d(c.createdAt),
      updatedAt: d(c.updatedAt),
    }))
    customers = rawCustomers
  } catch {
    // DATABASE_URL not set (local dev without DB)
  }

  return <ContractsClient initialContracts={serialized} initialCustomers={customers} />
}
