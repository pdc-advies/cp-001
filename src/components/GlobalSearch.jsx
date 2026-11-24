'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Loader2, ArrowRight } from 'lucide-react'
import SmartSearch from '@/components/SmartSearch'
import { contractSchema } from '@/lib/searchSchemas'

// Haalt globale zoekresultaten op (met vertraging tijdens het typen)
export function useGlobalSearch(query, limit) {
  const [state, setState] = useState({ data: null, loading: false, error: null })
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setState({ data: null, loading: false, error: null })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal: ctrl.signal })
        .then(async (res) => {
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
          setState({ data: json, loading: false, error: null })
        })
        .catch((err) => err.name !== 'AbortError' && setState({ data: null, loading: false, error: err.message }))
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, limit])
  return state
}

export function SearchResults({ data, loading, error, onNavigate, compact = false }) {
  if (error) return <p className="px-4 py-3 text-sm text-red-700">Fout: {error}</p>
  if (!data) return loading ? <Loader2 className="w-5 h-5 mx-auto my-6 animate-spin text-gray-400" /> : null
  if (!data.groups.length) return <p className="px-4 py-6 text-sm text-center text-gray-400">Niets gevonden voor “{data.query}”.</p>
  return (
    <div className={compact ? 'divide-y divide-gray-100' : 'space-y-5'}>
      {data.groups.map((g) => (
        <section key={g.key} className={compact ? 'py-2' : 'bg-white rounded-xl border border-gray-200 overflow-hidden'}>
          <h2 className={`flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-gray-500 ${compact ? 'px-4 pb-1' : 'px-4 py-2 bg-gray-50 border-b border-gray-200'}`}>
            {g.label}
            <span className="font-normal normal-case tracking-normal text-gray-400">{g.total > g.items.length ? `${g.items.length} van ${g.total}` : g.total}</span>
          </h2>
          <ul className={compact ? '' : 'divide-y divide-gray-100'}>
            {g.items.map((it) => (
              <li key={`${g.key}-${it.id}`}>
                <Link href={it.href} onClick={onNavigate} className="block px-4 py-1.5 hover:bg-blue-50">
                  <span className="text-sm font-medium text-gray-800">{it.title}</span>
                  {it.subtitle && <span className="block text-xs text-gray-500 truncate">{it.subtitle}</span>}
                  {it.notes?.length > 0 && <span className="block text-xs text-emerald-700">{it.notes.join(' · ')}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// Zoekknop in de kopbalk; opent een zoekvenster (ook met Ctrl/⌘+K of /)
export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const result = useGlobalSearch(open ? query : '', 5)
  const boxRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showAll = (q) => {
    if (!q.trim()) return
    setOpen(false)
    router.push(`/zoeken?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700"
      >
        <Search className="w-4 h-4" />
        <span className="hidden lg:inline">Zoeken</span>
        <kbd className="hidden lg:inline text-[10px] font-sans text-gray-400 border border-gray-200 rounded px-1">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={(e) => !boxRef.current?.contains(e.target) && setOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div ref={boxRef} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <SmartSearch
                value={query}
                onChange={setQuery}
                schema={contractSchema}
                autoFocus
                onEnter={showAll}
                placeholder="Zoek in alles: SCA0001, €1000-5000, ov 2024, debiteur, notitie…"
              />
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {query.trim() ? (
                <SearchResults {...result} compact onNavigate={() => setOpen(false)} />
              ) : (
                <p className="px-4 py-6 text-sm text-gray-400">Zoekt in contracten, klanten, notities en, waar beschikbaar, facturen, Unit4 en berichten. Klik op het vraagteken voor voorbeelden.</p>
              )}
            </div>
            {query.trim() && (
              <button type="button" onClick={() => showAll(query)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-blue-700 bg-gray-50 border-t border-gray-100 hover:bg-blue-50">
                Alle resultaten tonen
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">Enter <ArrowRight className="w-3.5 h-3.5" /></span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
