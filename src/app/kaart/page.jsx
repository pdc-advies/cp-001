import ContractMapClient from '@/components/ContractMapClient'
import { isDemo } from '@/lib/demo'

export const metadata = { title: 'Kaart · Contract Register' }

export default function KaartPage() {
  return <ContractMapClient demo={isDemo()} />
}
