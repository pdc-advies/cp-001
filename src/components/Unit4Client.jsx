'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookCheck, Banknote, Loader2 } from 'lucide-react'
import { journalLines } from '@/lib/invoicing'
import { eur, fmtDate } from '@/components/InvoiceStatus'
import SmartSearch, { useUrlQuery } from '@/components/SmartSearch'
import { searchRecords } from '@/lib/search'
import { unit4Schema } from '@/lib/searchSchemas'

const U4_STATUS = {
  ontvangen: 'bg-amber-50 text-amber-800',
  geboekt: 'bg-blue-50 text-blue-700',
  betaald: 'bg-green-50 text-green-700',
}

// Unit4 kent alleen het ontvangen bericht; de journaalpost volgt uit die gegevens
const asJournal = (p) => ({
  debiteurnummer: p.invoice.customer.debtorNumber,
  customerName: p.invoice.customer.name,
  lines: p.invoice.lines.map((l) => ({ grootboek: l.ledgerAccount, omschrijving: l.description, bedrag: l.amount })),
  vatAmount: p.invoice.totals.vat,
  total: p.invoice.totals.gross,
})

export default function Unit4Client() {
  const [records, setRecords] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useUrlQuery()

  const load = useCallback(async () => {
    const res = await fetch('/api/unit4/sales-invoices')
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    setRecords(json)
  }, [])

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [load])

  const act = async (id, action) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/unit4/sales-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Mislukt')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const hits = useMemo(() => (records ? searchRecords(records, search, unit4Schema) : []), [records, search])
  const selected = hits.find((h) => h.item.id === selectedId)?.item ?? hits[0]?.item
  const inv = selected?.payload.invoice
  const open = records?.filter((r) => r.status === 'ontvangen').length ?? 0

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-800 text-white px-5 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Unit4: verkoopfacturen</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400 text-slate-900">Simulatie</span>
        </div>
        <p className="text-sm text-slate-300 mt-1">
          De financiële applicatie. Kent alleen wat het Contractenportaal via de koppeling stuurt, kent het factuurnummer toe bij boeking en meldt boeking en betaling terug.
          {records && ` ${open} te boeken.`}
        </p>
      </div>

      <SmartSearch
        value={search}
        onChange={setSearch}
        schema={unit4Schema}
        placeholder="Zoek: factuurnummer, klant, contract, ontvangen, €500-1000, ov 2024…"
        resultCount={search && records ? hits.length : null}
        className="max-w-xl"
      />

      {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      {!records && !error && <Loader2 className="w-5 h-5 mx-auto animate-spin text-gray-400" />}
      {records?.length === 0 && <p className="text-sm text-gray-500">Nog niets ontvangen.</p>}

      {records?.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium">Factuur</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {hits.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Niets gevonden</td></tr>
                )}
                {hits.map(({ item: r, notes }) => (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)} className={`border-b border-gray-100 cursor-pointer ${selected?.id === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-800">{r.number ?? r.externalId}</span>
                      <span className="block text-xs text-gray-500">{r.payload.invoice.customer.name} · {r.payload.invoice.contract?.number} · {r.payload.invoice.period.label}</span>
                      {notes.length > 0 && <span className="block text-xs text-emerald-700">{notes.join(' · ')}</span>}
                    </td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${U4_STATUS[r.status]}`}>{r.status}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums">{eur(r.payload.invoice.totals.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selected.number ?? 'Nog niet geboekt'} · {inv.creditOf ? 'creditfactuur' : inv.type === 'belasting' ? 'belasting' : 'contract'}</h2>
                  <p className="text-xs text-gray-500">
                    Bron {selected.externalId}{inv.creditOf && `, crediteert ${inv.creditOf}`} · factuurdatum {fmtDate(inv.invoiceDate)} · vervaldatum {fmtDate(inv.dueDate)}
                  </p>
                  {selected.bookedAt && <p className="text-xs text-gray-500">Geboekt {fmtDate(selected.bookedAt)} door {selected.bookedBy}{selected.paidAt && ` · betaald ${fmtDate(selected.paidAt)}`}</p>}
                </div>
                <div className="flex gap-2">
                  {selected.status === 'ontvangen' && (
                    <button onClick={() => act(selected.id, 'book')} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">
                      <BookCheck className="w-4 h-4" />
                      Boeken
                    </button>
                  )}
                  {selected.status === 'geboekt' && (
                    <button onClick={() => act(selected.id, 'pay')} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50">
                      <Banknote className="w-4 h-4" />
                      Betaling registreren
                    </button>
                  )}
                </div>
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
                  {journalLines(asJournal(selected.payload)).map((l, n) => (
                    <tr key={n} className="border-b border-gray-100 align-top">
                      <td className="py-1.5 pr-2 text-gray-700">{l.rekening}</td>
                      <td className="py-1.5 pr-2 text-gray-600">{l.omschrijving}</td>
                      <td className="py-1.5 text-right tabular-nums">{l.debet != null && eur(l.debet)}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{l.credit != null && eur(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer">Ontvangen bericht</summary>
                <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-96">{JSON.stringify(selected.payload, null, 2)}</pre>
              </details>
              <p className="text-xs text-gray-400">Rekeningnummers zijn voorbeelden.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
