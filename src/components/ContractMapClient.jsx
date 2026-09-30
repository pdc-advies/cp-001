'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, Download, MapPin, CircleAlert, CircleDashed, X, Loader2 } from 'lucide-react'
import { STATUS_CONFIG } from '@/lib/esriContracts'

// ArcGIS draait alleen in de browser
const ArcgisContractMap = dynamic(() => import('./ArcgisContractMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-sm text-gray-400">Kaart laden…</div>,
})

const MATCH_CONFIG = {
  volledig: { label: 'Gevonden', icon: MapPin, className: 'text-blue-500' },
  deels: { label: 'Deels gevonden', icon: MapPin, className: 'text-amber-500' },
  geen: { label: 'Niet in kadaster', icon: CircleAlert, className: 'text-red-500' },
  onleesbaar: { label: 'Onleesbaar', icon: CircleDashed, className: 'text-gray-400' },
}

const nf0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 })
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fmtNum = (v) => (v == null ? '—' : nf0.format(v))
const fmtEur = (v) => (v == null ? '—' : eur.format(v))
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${config.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function MatchIcon({ match }) {
  const { icon: Icon, className, label } = MATCH_CONFIG[match]
  return <Icon className={`w-3.5 h-3.5 shrink-0 ${className}`} aria-label={label} />
}

function Detail({ p, onClose }) {
  const diff = p.kadasterM2 && p.m2 ? Math.round((p.m2 / p.kadasterM2) * 1000) / 10 : null
  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm max-h-72 overflow-auto">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <a href={`/contracts/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{p.contractNumber}</a>
            <StatusBadge status={p.status} />
          </div>
          <p className="text-gray-500 text-xs mt-0.5">{p.customerName} · {p.contractType || '—'}</p>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded" title="Sluiten">
          <X className="w-4 h-4" />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <dt className="text-gray-500">Looptijd</dt><dd className="text-right">{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</dd>
        <dt className="text-gray-500">Jaarprijs</dt><dd className="text-right">{fmtEur(p.jaarprijs)}</dd>
        <dt className="text-gray-500">m² contract / kadaster</dt>
        <dd className="text-right">{fmtNum(p.m2)} / {fmtNum(p.kadasterM2)}{diff != null && <span className="text-gray-400"> ({diff}%)</span>}</dd>
        <dt className="text-gray-500">Kadastrale aanduiding</dt><dd className="text-right">{p.kadastrale || '—'}</dd>
      </dl>
      {p.percelen.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {p.percelen.map((perceel) => (
            <li key={perceel.label} className="flex items-center gap-2">
              {perceel.gevonden ? <MapPin className="w-3 h-3 text-blue-500" /> : <CircleAlert className="w-3 h-3 text-red-500" />}
              <span className="text-gray-700">{perceel.label}</span>
              <span className="text-gray-400">
                {perceel.gevonden ? `${perceel.land === 'BE' ? 'kadaster BE' : perceel.brk} · ${fmtNum(perceel.grootte)} m²` : 'niet (meer) in kadaster'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {p.heeftGedeeltelijk && (
        <p className="mt-2 text-xs text-amber-700">Bevat gedeeltelijke percelen: de kaart toont het hele perceel.</p>
      )}
    </div>
  )
}

export default function ContractMapClient() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [matchFilter, setMatchFilter] = useState('all')
  const [landFilter, setLandFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    fetch('/api/contracts/geo')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
        setData(json)
      })
      .catch((err) => setError(err.message))
  }, [])

  const features = useMemo(() => data?.features ?? [], [data])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return features.filter(({ properties: p }) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (landFilter !== 'all' && !(p.land || '').includes(landFilter)) return false
      if (matchFilter === 'kaart' && !['volledig', 'deels'].includes(p.match)) return false
      if (matchFilter === 'niet' && ['volledig', 'deels'].includes(p.match)) return false
      if (!q) return true
      return [p.contractNumber, p.customerName, p.kadastrale, p.debiteurnummer, p.kostenplaats].some((v) =>
        (v || '').toLowerCase().includes(q)
      )
    })
  }, [features, search, statusFilter, matchFilter, landFilter])

  const visibleIds = useMemo(() => new Set(filtered.map((f) => f.properties.id)), [filtered])
  const activeSelectedId = visibleIds.has(selectedId) ? selectedId : null
  const selected = features.find((f) => f.properties.id === activeSelectedId)?.properties

  const counts = useMemo(() => {
    const c = { volledig: 0, deels: 0, geen: 0, onleesbaar: 0 }
    for (const f of features) c[f.properties.match]++
    return c
  }, [features])

  const exportGeoJSON = () => {
    const collection = { type: 'FeatureCollection', features: features.filter((f) => f.geometry) }
    const blob = new Blob([JSON.stringify(collection)], { type: 'application/geo+json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'contracten.geojson' })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-30 flex bg-white">
      <section className="w-[480px] shrink-0 flex flex-col min-h-0 border-r border-gray-200">
        <div className="p-4 space-y-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Contracten op de kaart</h1>
            <button
              onClick={exportGeoJSON}
              disabled={!data}
              title="Download als GeoJSON voor ArcGIS Online / ArcGIS Pro"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              GeoJSON
            </button>
          </div>
          {data && (
            <p className="text-xs text-gray-500">
              {counts.volledig + counts.deels} van {features.length} contracten op de kaart
              {' · '}{counts.deels} deels · {counts.geen} niet in kadaster · {counts.onleesbaar} onleesbaar
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Zoeken op nummer, klant, kadastraal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700">
              <option value="all">Alle statussen</option>
              <option value="active">Actief</option>
              <option value="expired">Verlopen</option>
              <option value="draft">Concept</option>
            </select>
            <select value={landFilter} onChange={(e) => setLandFilter(e.target.value)} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700">
              <option value="all">NL + BE</option>
              <option value="NL">Nederland</option>
              <option value="BE">België</option>
            </select>
            <select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700">
              <option value="all">Alle koppelingen</option>
              <option value="kaart">Op de kaart</option>
              <option value="niet">Niet op de kaart</option>
            </select>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {!data && !error && (
            <div className="p-8 text-center text-sm text-gray-400">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Percelen ophalen bij het Kadaster (PDOK)… de eerste keer kan dit ~15 seconden duren.
            </div>
          )}
          {error && <div className="m-4 px-3 py-2 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700">Fout: {error}</div>}
          <ul className="divide-y divide-gray-100">
            {filtered.map(({ properties: p }) => (
              <li
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`px-4 py-2 cursor-pointer text-sm ${activeSelectedId === p.id ? 'bg-blue-100/70' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  <MatchIcon match={p.match} />
                  <span className="font-medium text-gray-800">{p.contractNumber}</span>
                  {p.land && <span className="text-[10px] font-semibold text-gray-400">{p.land}</span>}
                  <span className="ml-auto"><StatusBadge status={p.status} /></span>
                </div>
                <div className="pl-5.5 flex justify-between gap-2 text-xs text-gray-500">
                  <span className="truncate">{p.customerName}</span>
                  <span className="truncate text-right">{p.kadastrale || '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {selected && <Detail p={selected} onClose={() => setSelectedId(null)} />}
      </section>

      <section className="flex-1 min-w-0">
        <ArcgisContractMap features={features} visibleIds={visibleIds} selectedId={activeSelectedId} onSelect={setSelectedId} />
      </section>
    </div>
  )
}
