'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FilePlus2, Send, Loader2 } from 'lucide-react'
import { FREQUENTIES, periodsFor } from '@/lib/invoicing'
import { StatusBadge, eur, invoiceKind } from '@/components/InvoiceStatus'

const JAREN = [2025, 2026, 2027]
const selectClass = 'px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const STATE = {
  gereed: { label: 'Gereed', className: 'text-blue-700' },
  gefactureerd: { label: 'Gefactureerd', className: 'text-green-700' },
  overgeslagen: { label: 'Overgeslagen', className: 'text-gray-500' },
}

const huidigeIndex = (frequency) => Math.floor(new Date().getMonth() / (12 / FREQUENTIES[frequency]))

export default function FactuurrunClient() {
  const [frequency, setFrequency] = useState('Kwartaal')
  const [year, setYear] = useState(new Date().getFullYear())
  const [index, setIndex] = useState(huidigeIndex('Kwartaal'))
  const [preview, setPreview] = useState(null)
  const [concepts, setConcepts] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const periods = periodsFor(frequency, year)

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([
      fetch(`/api/invoice-runs?frequency=${frequency}&year=${year}&index=${index}`).then((r) => r.json()),
      fetch('/api/invoices').then((r) => r.json()),
    ])
    if (p.error) throw new Error(p.error)
    setPreview(p)
    setConcepts(i.filter((x) => x.status === 'aangemaakt'))
  }, [frequency, year, index])

  useEffect(() => {
    setPreview(null)
    setError(null)
    load().catch((err) => setError(err.message))
  }, [load])

  const changeFrequency = (f) => {
    setFrequency(f)
    setIndex(huidigeIndex(f))
  }

  const act = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const call = async (url, method, body) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json()).error || 'Er ging iets mis')
  }

  const ready = preview?.rows.filter((r) => r.state === 'gereed') ?? []
  const runConcepts = concepts.filter((c) => c.runKey === preview?.runKey)
  const otherConcepts = concepts.filter((c) => c.runKey !== preview?.runKey)
  const sendAll = (list) => act(async () => {
    for (const c of list) await call(`/api/invoices/${c.id}`, 'PATCH', { action: 'send' })
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Factuurrun</h1>
        <p className="text-sm text-gray-500">
          CP-001 bepaalt per periode welke contracten gefactureerd worden, maakt concepten uit de contractgegevens en stuurt ze na controle naar Unit4.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-xs font-medium text-gray-500">Frequentie<br />
          <select value={frequency} onChange={(e) => changeFrequency(e.target.value)} className={selectClass}>
            {Object.keys(FREQUENTIES).map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">Jaar<br />
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
            {JAREN.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">Periode<br />
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))} disabled={periods.length === 1} className={selectClass}>
            {periods.map((p) => <option key={p.index} value={p.index}>{p.label}</option>)}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => act(() => call('/api/invoice-runs', 'POST', { frequency, year, index }))}
            disabled={busy || !ready.length}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FilePlus2 className="w-4 h-4" />
            Concepten aanmaken ({ready.length})
          </button>
          <button
            onClick={() => sendAll(runConcepts)}
            disabled={busy || !runConcepts.length}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Concepten versturen naar Unit4 ({runConcepts.length})
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      {!preview && !error && <Loader2 className="w-5 h-5 mx-auto animate-spin text-gray-400" />}

      {preview && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
            {preview.period.label}: {preview.rows.length} contract{preview.rows.length === 1 ? '' : 'en'} met frequentie {frequency.toLowerCase()}
            {preview.zonderFrequentie > 0 && <span className="text-gray-400"> · {preview.zonderFrequentie} zonder vaste frequentie (niet in een run)</span>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left font-medium">Contract</th>
                <th className="px-4 py-2 text-left font-medium">Klant</th>
                <th className="px-4 py-2 text-left font-medium">Run</th>
                <th className="px-4 py-2 text-left font-medium">Factuur</th>
                <th className="px-4 py-2 text-right font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.contractId} className="border-b border-gray-100 align-top">
                  <td className="px-4 py-2"><Link href={`/contracts/${r.contractId}#facturatie`} className="font-medium text-blue-700 hover:underline">{r.contractNumber}</Link></td>
                  <td className="px-4 py-2 text-gray-600">{r.customerName}</td>
                  <td className="px-4 py-2">
                    <span className={STATE[r.state].className}>{STATE[r.state].label}</span>
                    {r.reason && r.state !== 'gefactureerd' && <span className="block text-xs text-gray-400">{r.reason}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {r.invoice ? (
                      <Link href={`/facturen/${r.invoice.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <StatusBadge status={r.invoice.status} />
                        <span className="text-xs text-gray-500">{r.invoice.unit4Number ?? r.invoice.periodLabel}</span>
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{eur(r.invoice?.total ?? r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {otherConcepts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Overige concepten (belastingaanslagen, losse facturen, andere runs)</h2>
            <button onClick={() => sendAll(otherConcepts)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" />
              Alle versturen ({otherConcepts.length})
            </button>
          </div>
          <ul className="divide-y divide-gray-100 text-sm">
            {otherConcepts.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24">{invoiceKind(c)}</span>
                <Link href={`/facturen/${c.id}`} className="text-blue-700 hover:underline">{c.contractNumber} · {c.periodLabel}</Link>
                <span className="ml-auto tabular-nums">{eur(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
