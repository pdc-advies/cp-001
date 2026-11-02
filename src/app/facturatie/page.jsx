import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'
import FacturatieClient from '@/components/FacturatieClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Facturatie · Contract Register' }

const day = (d) => (d ? d.toISOString().slice(0, 10) : null)

export default async function FacturatiePage({ searchParams }) {
  if (!isDemo()) notFound()
  const [contracts, btwCodes, customers] = await Promise.all([
    prisma.contract.findMany({ orderBy: { contractNumber: 'asc' } }),
    prisma.btwCode.findMany({ orderBy: { code: 'asc' } }),
    prisma.customer.findMany(),
  ])
  const customerName = Object.fromEntries(customers.map((k) => [k.debiteurnummer, k.name]))
  const serialized = contracts.map((c) => ({
    ...c,
    customerName: customerName[c.debiteurnummer] ?? c.customerName,
    startDate: day(c.startDate),
    endDate: day(c.endDate),
    invoiceStartDate: day(c.invoiceStartDate),
    invoiceEndDate: day(c.invoiceEndDate),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))
  const requested = Number((await searchParams)?.contract)
  return <FacturatieClient contracts={serialized} btwCodes={btwCodes} initialId={requested || serialized[0]?.id} />
}
