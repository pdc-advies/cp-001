import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'
import MessageSearch from '@/components/MessageSearch'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Koppelingen · Contractenportaal' }

export default async function KoppelingenPage() {
  if (!isDemo()) notFound()
  const messages = await prisma.interfaceMessage.findMany({ orderBy: { id: 'desc' }, take: 1000 })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Koppelingen</h1>
        <p className="text-sm text-gray-500">
          Alle berichten tussen het Contractenportaal en Unit4. Het Contractenportaal stuurt facturen naar <code>POST /api/unit4/sales-invoices</code>; Unit4 meldt boeking en betaling terug op <code>POST /api/interface/unit4/invoice-status</code>.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <MessageSearch messages={JSON.parse(JSON.stringify(messages))} showInvoice />
      </div>
    </div>
  )
}
