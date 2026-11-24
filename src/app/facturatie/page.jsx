import { notFound } from 'next/navigation'
import { isDemo } from '@/lib/demo'
import FactuurrunClient from '@/components/FactuurrunClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Terugvorderen Grondgebonden Heffingen · Contractenportaal' }

export default function FactuurrunPage() {
  if (!isDemo()) notFound()
  return <FactuurrunClient />
}
