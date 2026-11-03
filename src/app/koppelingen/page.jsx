import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'
import MessageList from '@/components/MessageList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Koppelingen · Contract Register' }

export default async function KoppelingenPage() {
  if (!isDemo()) notFound()
  const messages = await prisma.interfaceMessage.findMany({ orderBy: { id: 'desc' }, take: 200 })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Koppelingen</h1>
        <p className="text-sm text-gray-500">
          Alle berichten tussen CP-001 en Unit4. CP-001 stuurt facturen naar <code>POST /api/unit4/sales-invoices</code>; Unit4 meldt boeking en betaling terug op <code>POST /api/interface/unit4/invoice-status</code>.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <MessageList messages={JSON.parse(JSON.stringify(messages))} showInvoice />
      </div>
    </div>
  )
}
