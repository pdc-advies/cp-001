import { prisma } from '@/lib/prisma'
import CustomersClient from '@/components/CustomersClient'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  let customers = []
  try {
    customers = await prisma.customer.findMany({ orderBy: { debiteurnummer: 'asc' } })
  } catch {}
  return <CustomersClient initialCustomers={customers} />
}
