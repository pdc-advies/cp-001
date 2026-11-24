'use client'

import { useMemo } from 'react'
import MessageList from '@/components/MessageList'
import SmartSearch, { useUrlQuery } from '@/components/SmartSearch'
import { searchRecords } from '@/lib/search'
import { messageSchema } from '@/lib/searchSchemas'

// Berichten van de koppeling doorzoeken, ook de volledige inhoud (contractnummer, bedrag, factuurnummer…)
export default function MessageSearch({ messages, showInvoice = false }) {
  const [search, setSearch] = useUrlQuery()
  const shown = useMemo(() => searchRecords(messages, search, messageSchema).map((r) => r.item), [messages, search])
  return (
    <div className="space-y-4">
      <SmartSearch
        value={search}
        onChange={setSearch}
        schema={messageSchema}
        placeholder="Zoek in berichten: SCA0001, CP001-12, fout, jaar 2026, > 5000…"
        resultCount={search ? shown.length : null}
        className="max-w-xl"
      />
      {search && !shown.length ? <p className="text-sm text-gray-400">Geen berichten gevonden.</p> : <MessageList messages={shown} showInvoice={showInvoice} />}
    </div>
  )
}
