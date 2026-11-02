'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookCheck, Loader2 } from 'lucide-react'
import { journalLines } from '@/lib/invoicing'

const eur = (v) => (v == null ? '' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v))
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export default function Unit4Client() {
  const [invoices, setInvoices] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/invoices')
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    setInvoices(json.filter((i) => i.status !== 'aangemaakt'))
  }, [])

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [load])

  const book = async (id) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'book' }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Boeken mislukt')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const selected = invoices?.find((i) => i.id === selectedId) ?? invoices?.[0]
  const open = invoices?.filter((i) => i.status === 'verzonden').length ?? 0

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-800 text-white px-5 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Financiële applicatie</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400 text-slate-900">Simulatie, geen echte Unit4</span>
        </div>
        <p className="text-sm text-slate-300 mt-1">Ontvangt facturen uit CP-001, kent het factuurnummer toe en boekt ze in het grootboek. {invoices && `${open} wacht${open === 1 ? '' : 'en'} op boeking.`}</p>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      {!invoices && !error && <Loader2 className="w-5 h-5 mx-auto animate-spin text-gray-400" />}
      {invoices?.length === 0 && (
        <p className="text-sm text-gray-500">Nog niets ontvangen. Maak een factuur onder Facturatie en stuur die naar Unit4.</p>
      )}

      {invoices?.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium">Factuur</th>
                  <th className="px-4 py-2 text-left font-medium">Debiteur</th>
                  <th className="px-4 py-2 text-right font-medium">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} onClick={() => setSelectedId(i.id)} className={`border-b border-gray-100 cursor-pointer ${selected?.id === i.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-800">{i.unit4Number ?? 'Nog te boeken'}</span>
                      <span className="block text-xs text-gray-500">{i.contractNumber} · {i.periodLabel}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{i.customerName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{eur(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selected.contractNumber} · {selected.periodLabel}</h2>
                  <p className="text-xs text-gray-500">
                    {selected.type === 'belasting' && `Aanslag ontvangen ${fmtDate(selected.taxReceivedAt)}${selected.taxReference ? ` (${selected.taxReference})` : ''} · `}
                    Ontvangen {fmtDate(selected.sentAt)}{selected.bookedAt && ` · geboekt ${fmtDate(selected.bookedAt)} door ${selected.bookedBy}`}
                  </p>
                </div>
                {selected.status === 'verzonden' && (
                  <button onClick={() => book(selected.id)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">
                    <BookCheck className="w-4 h-4" />
                    Boeken
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-1.5 text-left font-medium">Rekening</th>
                    <th className="py-1.5 text-left font-medium">Omschrijving</th>
                    <th className="py-1.5 text-right font-medium">Debet</th>
                    <th className="py-1.5 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journalLines(selected).map((l, n) => (
                    <tr key={n} className="border-b border-gray-100 align-top">
                      <td className="py-1.5 pr-2 text-gray-700">{l.rekening}</td>
                      <td className="py-1.5 pr-2 text-gray-600">{l.omschrijving}</td>
                      <td className="py-1.5 text-right tabular-nums">{eur(l.debet)}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{eur(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400">Rekeningnummers zijn voorbeelden.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
