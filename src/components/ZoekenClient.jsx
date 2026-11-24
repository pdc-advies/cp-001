'use client'

import SmartSearch, { useUrlQuery } from '@/components/SmartSearch'
import { SearchResults, useGlobalSearch } from '@/components/GlobalSearch'
import { contractSchema } from '@/lib/searchSchemas'

// Zoeken in de hele database (/zoeken?q=...)
export default function ZoekenClient() {
  const [query, setQuery] = useUrlQuery()
  const result = useGlobalSearch(query, 50)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Zoeken</h1>
        <p className="text-sm text-gray-500">In contracten, klanten, notities en, waar beschikbaar, facturen, Unit4 en berichten.</p>
      </div>
      <SmartSearch
        value={query}
        onChange={setQuery}
        schema={contractSchema}
        autoFocus
        placeholder="SCA0001, €1000-5000, ov 2023-2025 > 5000, jaar 2024 actief…"
        className="max-w-2xl"
      />
      {query.trim() && <SearchResults {...result} />}
    </div>
  )
}
