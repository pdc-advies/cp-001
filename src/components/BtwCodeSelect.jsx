'use client'

import Link from 'next/link'

// Keuze uit de BTW codes (beheerd onder BTW Codes). Een code op het contract die daar niet bestaat
// (bv. uit de Unit4-import) blijft zichtbaar, met een waarschuwing: er wordt dan 0% btw gerekend.
export default function BtwCodeSelect({ value, onChange, codes = [], className = '' }) {
  const known = codes.some((b) => b.code === value)
  return (
    <div>
      <select value={value ?? ''} onChange={onChange} className={className}>
        <option value="">Geen BTW code</option>
        {codes.map((b) => (
          <option key={b.id} value={b.code}>
            {b.code} · {b.description}{b.percentage != null ? ` (${b.percentage}%)` : ''}
          </option>
        ))}
        {value && !known && <option value={value}>{value} · niet gedefinieerd</option>}
      </select>
      {value && !known && (
        <p className="mt-1 text-xs text-amber-700">
          Code “{value}” staat niet onder{' '}
          <Link href={`/btw-codes?nieuw=${encodeURIComponent(value)}`} className="underline hover:text-amber-900">BTW Codes</Link>
          ; facturen rekenen nu 0% btw.
        </p>
      )}
      {!codes.length && (
        <p className="mt-1 text-xs text-gray-500">
          Nog geen BTW codes. <Link href="/btw-codes" className="text-blue-600 hover:underline">Maak ze aan onder BTW Codes</Link>.
        </p>
      )}
    </div>
  )
}
