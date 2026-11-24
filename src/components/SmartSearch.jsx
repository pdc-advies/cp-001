'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, HelpCircle } from 'lucide-react'
import { VOORBEELDEN, parseQuery } from '@/lib/search'

const CHIP = {
  text: 'bg-gray-100 text-gray-700',
  amount: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  years: 'bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-600/20',
  status: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
  field: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-600/20',
}

// Zoekterm uit en naar de URL (?q=), zodat een zoekopdracht te delen is en het globale zoeken ernaar kan linken
export function useUrlQuery(param = 'q') {
  const [value, setValue] = useState('')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get(param)
    if (q) setValue(q)
  }, [param])
  const update = (v) => {
    setValue(v)
    const url = new URL(window.location.href)
    if (v) url.searchParams.set(param, v)
    else url.searchParams.delete(param)
    window.history.replaceState(window.history.state, '', url)
  }
  return [value, update]
}

// Zoekveld dat laat zien hoe de zoekopdracht begrepen is (bedrag, jaar, status, ...)
export default function SmartSearch({ value, onChange, schema, placeholder = 'Zoeken…', className = '', autoFocus = false, onEnter, resultCount }) {
  const [help, setHelp] = useState(false)
  const inputRef = useRef(null)
  const parsed = useMemo(() => parseQuery(value, schema), [value, schema])
  const interpreted = parsed.chips.filter((c) => c.kind !== 'text' || parsed.chips.length > 1)

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.stopPropagation()
              onChange('')
            }
            if (e.key === 'Enter' && onEnter) onEnter(value)
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-16 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
          {value && (
            <button type="button" onClick={() => { onChange(''); inputRef.current?.focus() }} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Wissen">
              <X className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => setHelp((h) => !h)} className={`p-1 ${help ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} aria-label="Zoektips">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {interpreted.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {interpreted.map((c, i) => (
            <span
              key={i}
              title={c.supported ? undefined : 'Wordt op dit scherm niet gebruikt'}
              className={`px-2 py-0.5 rounded-full text-xs ${c.supported ? CHIP[c.kind] : 'bg-gray-50 text-gray-400 line-through'}`}
            >
              {c.label}
            </span>
          ))}
          {resultCount != null && <span className="text-xs text-gray-400">· {resultCount} gevonden</span>}
        </div>
      )}

      {help && (
        <div className="absolute z-50 mt-1.5 w-[22rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Zo kun je zoeken (klik om te proberen)</p>
          <ul className="space-y-1">
            {VOORBEELDEN.map(([q, uitleg]) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => { onChange(q); setHelp(false); inputRef.current?.focus() }}
                  className="w-full flex items-baseline gap-2 text-left px-1.5 py-0.5 rounded hover:bg-gray-50"
                >
                  <code className="text-xs text-blue-700 whitespace-nowrap">{q}</code>
                  <span className="text-xs text-gray-500">{uitleg}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-2">Een los getal zoekt als nummer (debiteur, contract). Gebruik €, &gt;, &lt; of een bereik voor bedragen. Meerdere woorden moeten allemaal voorkomen.</p>
        </div>
      )}
    </div>
  )
}
