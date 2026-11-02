import { notFound } from 'next/navigation'
import { isDemo } from '@/lib/demo'
import Unit4Client from '@/components/Unit4Client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Unit4 (simulatie) · Contract Register' }

export default function Unit4Page() {
  if (!isDemo()) notFound()
  return <Unit4Client />
}
