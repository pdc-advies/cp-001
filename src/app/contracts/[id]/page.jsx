import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ContractEditForm from '@/components/ContractEditForm'

export const dynamic = 'force-dynamic'

function serializeDate(d) {
  return d ? (d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]) : null
}

export default async function ContractEditPage({ params }) {
  let contract, customers = []
  try {
    contract = await prisma.contract.findFirst({ where: { id: parseInt(params.id) } })
    customers = await prisma.customer.findMany({ orderBy: { debiteurnummer: 'asc' } })
  } catch {}

  if (!contract) notFound()

  const serialized = {
    ...contract,
    startDate: serializeDate(contract.startDate),
    endDate: serializeDate(contract.endDate),
    invoiceStartDate: serializeDate(contract.invoiceStartDate),
    invoiceEndDate: serializeDate(contract.invoiceEndDate),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  }

  return <ContractEditForm contract={serialized} customers={customers} />
}
