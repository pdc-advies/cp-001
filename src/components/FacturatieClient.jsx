'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Save, RotateCcw, FileText, Send, Trash2, ExternalLink, Calculator } from 'lucide-react'
import { FREQUENTIES, buildInvoice, periodsFor } from '@/lib/invoicing'
import { BASISTARIEF, heeftCoefficient } from '@/lib/onroerendeVoorheffing'
import { parseKadastrale } from '@/lib/kadastrale'
import opcentiemen from '@/lib/opcentiemen.json'

const SIMULATOR_URL = 'https://belastingen.fenb.be/ui/public/simulaties/ov'
const JAREN = [2025, 2026, 2027]

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
const eur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (d) => new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })

const STATUS = {
  aangemaakt: { label: 'Aangemaakt in CP-001', className: 'bg-gray-100 text-gray-700' },
  verzonden: { label: 'Verzonden naar Unit4', className: 'bg-amber-50 text-amber-800' },
  geboekt: { label: 'Geboekt in Unit4', className: 'bg-green-50 text-green-700' },
}

// De velden waarmee je kunt spelen; lege waarden als '' zodat invoervelden gecontroleerd blijven
const FIELDS = ['m2', 'pricePerM2', 'fixedPrice', 'contractValue', 'invoiceFrequency', 'btwCode', 'kadastraalInkomen', 'ovGemeente', 'ovProvincie', 'ovOpcentiemenGemeente', 'ovOpcentiemenProvincie']
const toForm = (c) => Object.fromEntries(FIELDS.map((f) => [f, c[f] ?? (f === 'fixedPrice' ? false : '')]))

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value, strong = false }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${strong ? 'font-semibold text-gray-900 border-t border-gray-200 pt-1.5' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}

export default function FacturatieClient({ contracts, btwCodes, initialId }) {
  const router = useRouter()
  const [contractId, setContractId] = useState(initialId)
  const contract = contracts.find((c) => c.id === contractId) ?? contracts[0]
  const saved = useMemo(() => toForm(contract), [contract])
  const [form, setForm] = useState(saved)
  const [year, setYear] = useState(new Date().getFullYear())
  const [index, setIndex] = useState(0)
  const [invoices, setInvoices] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setForm(saved)
    setIndex(0)
    setError(null)
  }, [saved])

  const loadInvoices = useCallback(async () => {
    const res = await fetch('/api/invoices')
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    setInvoices(json)
  }, [])

  useEffect(() => {
    loadInvoices().catch((err) => setError(err.message))
  }, [loadInvoices])

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))
  const dirty = FIELDS.some((f) => String(form[f]) !== String(saved[f]))
  const isBE = parseKadastrale(contract.kadastrale).some((p) => p.land === 'BE') || form.kadastraalInkomen !== ''

  const frequency = form.invoiceFrequency in FREQUENTIES ? form.invoiceFrequency : 'Kwartaal'
  const periods = periodsFor(frequency, year)
  const period = periods[Math.min(index, periods.length - 1)]
  const btwPercentage = btwCodes.find((b) => b.code === form.btwCode)?.percentage
  const merged = { ...contract, ...form }
  const preview = buildInvoice(merged, period, btwPercentage)
  // Vergelijking: wat de klant per maand, kwartaal of jaar krijgt (eerste periode van het jaar)
  const compare = Object.keys(FREQUENTIES).map((f) => {
    const p = periodsFor(f, year)
    const lines = p.map((x) => buildInvoice(merged, x, btwPercentage)).filter((i) => !i.error)
    return { f, per: lines[0]?.total, n: lines.length, jaar: lines.reduce((s, i) => s + i.total, 0) }
  })

  const contractInvoices = invoices.filter((i) => i.contractId === contract.id)

  const pickGemeente = (e) => {
    const gemeente = opcentiemen.gemeenten.find((g) => g.naam === e.target.value)
    setForm((p) => ({ ...p, ovGemeente: e.target.value, ovOpcentiemenGemeente: gemeente?.opcentiemen ?? p.ovOpcentiemenGemeente }))
  }
  const pickProvincie = (e) => {
    const naam = e.target.value
    setForm((p) => ({ ...p, ovProvincie: naam, ovOpcentiemenProvincie: opcentiemen.provincies[naam] ?? p.ovOpcentiemenProvincie }))
  }

  const run = async (url, options) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, options)
      if (!res.ok) throw new Error((await res.json()).error || 'Er ging iets mis')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const saveContract = async () => {
    const ok = await run(`/api/contracts/${contract.id}`, json('PATCH', form))
    if (ok) router.refresh()
  }
  const createInvoice = async () => {
    if (await run('/api/invoices', json('POST', { contractId: contract.id, year, index: period.index }))) await loadInvoices()
  }
  const invoiceAction = async (id, action) => {
    if (await run(`/api/invoices/${id}`, json('PATCH', { action }))) await loadInvoices()
  }
  const removeInvoice = async (id) => {
    if (await run(`/api/invoices/${id}`, { method: 'DELETE' })) await loadInvoices()
  }

  const blocked = dirty
    ? 'Sla de gewijzigde cijfers eerst op in het contract, of zet ze terug'
    : contract.status === 'draft'
      ? 'Een conceptcontract kan niet gefactureerd worden'
      : preview.error

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Facturatie</h1>
          <p className="text-sm text-gray-500">
            CP-001 maakt de factuur uit de contractgegevens en stuurt die naar de financiële applicatie. Demo: verander de cijfers en de factuur rekent mee.
          </p>
        </div>
        <Link href="/unit4" className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
          Naar Unit4 (simulatie)
        </Link>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <Card title="Contract">
            <Field label="Contract">
              <select value={contract.id} onChange={(e) => setContractId(Number(e.target.value))} className={inputClass}>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contractNumber} · {c.customerName}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-gray-500">
              {contract.contractType || 'Contract'} · looptijd {contract.startDate ? fmtDate(contract.startDate) : '—'} t/m {contract.endDate ? fmtDate(contract.endDate) : 'onbepaald'} · {contract.kadastrale || 'geen perceel'}
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={Boolean(form.fixedPrice)} onChange={(e) => setForm((p) => ({ ...p, fixedPrice: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
              Vaste jaarprijs (geen m²-berekening)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {form.fixedPrice ? (
                <Field label="Jaarprijs (€)">
                  <input type="number" step="0.01" min="0" value={form.contractValue} onChange={set('contractValue')} className={inputClass} />
                </Field>
              ) : (
                <>
                  <Field label="Oppervlakte (m²)">
                    <input type="number" step="1" min="0" value={form.m2} onChange={set('m2')} className={inputClass} />
                  </Field>
                  <Field label="Prijs per m² per jaar (€)">
                    <input type="number" step="0.01" min="0" value={form.pricePerM2} onChange={set('pricePerM2')} className={inputClass} />
                  </Field>
                </>
              )}
              <Field label="Frequentie">
                <select value={frequency} onChange={set('invoiceFrequency')} className={inputClass}>
                  {Object.keys(FREQUENTIES).map((f) => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="BTW">
                <select value={form.btwCode} onChange={set('btwCode')} className={inputClass}>
                  <option value="">Geen</option>
                  {btwCodes.map((b) => <option key={b.id} value={b.code}>{b.code} ({b.percentage ?? 0}%)</option>)}
                </select>
              </Field>
            </div>
          </Card>

          {isBE && (
            <Card title="Onroerende voorheffing (Vlaanderen, volledig doorbelast)">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kadastraal inkomen, niet geïndexeerd (€)">
                  <input type="number" step="1" min="0" value={form.kadastraalInkomen} onChange={set('kadastraalInkomen')} className={inputClass} />
                </Field>
                <div />
                <Field label="Gemeente">
                  <select value={form.ovGemeente} onChange={pickGemeente} className={inputClass}>
                    <option value="">Kies…</option>
                    {opcentiemen.gemeenten.map((g) => <option key={g.naam}>{g.naam}</option>)}
                  </select>
                </Field>
                <Field label="Provincie">
                  <select value={form.ovProvincie} onChange={pickProvincie} className={inputClass}>
                    <option value="">Kies…</option>
                    {Object.keys(opcentiemen.provincies).map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Opcentiemen gemeente">
                  <input type="number" step="0.01" min="0" value={form.ovOpcentiemenGemeente} onChange={set('ovOpcentiemenGemeente')} className={inputClass} />
                </Field>
                <Field label="Opcentiemen provincie">
                  <input type="number" step="0.01" min="0" value={form.ovOpcentiemenProvincie} onChange={set('ovOpcentiemenProvincie')} className={inputClass} />
                </Field>
              </div>
              {preview.ov ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 space-y-1">
                  <Row label={`Geïndexeerd KI (× ${preview.ov.coefficient.toLocaleString('nl-NL', { minimumFractionDigits: 4 })})`} value={eur(preview.ov.geindexeerdKI)} />
                  <Row label={`Basisheffing Vlaams Gewest (${(BASISTARIEF * 100).toLocaleString('nl-NL')}%)`} value={eur(preview.ov.basisheffing)} />
                  <Row label="Opcentiemen provincie" value={eur(preview.ov.provincie)} />
                  <Row label="Opcentiemen gemeente" value={eur(preview.ov.gemeente)} />
                  <Row label={`Onroerende voorheffing ${year} (indicatief)`} value={eur(preview.ov.totaal)} strong />
                </div>
              ) : (
                <p className="text-xs text-gray-500">Vul een kadastraal inkomen in om de voorheffing te berekenen.</p>
              )}
              {!heeftCoefficient(year) && (
                <p className="text-xs text-amber-700">De coëfficiënt voor {year} is nog niet gepubliceerd; de laatst bekende wordt gebruikt.</p>
              )}
              <p className="text-xs text-gray-500">
                Opcentiemen {opcentiemen.jaar} uit het overzicht van de Vlaamse overheid. Zonder verminderingen en verlaagde tarieven.{' '}
                <a href={SIMULATOR_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                  Controleer in de officiële simulator <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </Card>
          )}

          <div className="flex items-center gap-2">
            <button onClick={saveContract} disabled={!dirty || busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" />
              Opslaan in contract
            </button>
            <button onClick={() => setForm(saved)} disabled={!dirty || busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <RotateCcw className="w-4 h-4" />
              Terugzetten
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <Card title="Factuur">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jaar">
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass}>
                  {JAREN.map((y) => <option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label={frequency === 'Maand' ? 'Maand' : frequency === 'Kwartaal' ? 'Kwartaal' : 'Periode'}>
                <select value={period.index} onChange={(e) => setIndex(Number(e.target.value))} disabled={periods.length === 1} className={inputClass}>
                  {periods.map((p) => <option key={p.index} value={p.index}>{p.label}</option>)}
                </select>
              </Field>
            </div>

            {preview.error ? (
              <p className="px-3 py-2 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{preview.error}</p>
            ) : (
              <>
                <div className="text-xs text-gray-500">
                  <p>Debiteur {contract.debiteurnummer || '—'} · {contract.customerName}</p>
                  {preview.referentie && <p>Referentie: {preview.referentie}</p>}
                  {preview.factor < 1 && <p className="text-amber-700">Pro rata: {Math.round(preview.factor * 100)}% van de periode valt binnen de looptijd.</p>}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-1.5 text-left font-medium">Omschrijving</th>
                      <th className="py-1.5 text-right font-medium">Bedrag</th>
                      <th className="py-1.5 text-right font-medium">BTW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l) => (
                      <tr key={l.code} className="border-b border-gray-100 align-top">
                        <td className="py-2 pr-3 text-gray-700">{l.omschrijving}<span className="block text-xs text-gray-400">Grootboek {l.grootboek} · jaarbedrag {eur(l.jaarbedrag)}</span></td>
                        <td className="py-2 text-right tabular-nums">{eur(l.bedrag)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums text-gray-500">{eur(l.btw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-1">
                  <Row label="Subtotaal" value={eur(preview.subtotal)} />
                  <Row label={`BTW (${btwPercentage ?? 0}%)`} value={eur(preview.vatAmount)} />
                  <Row label="Totaal factuur" value={eur(preview.total)} strong />
                </div>
              </>
            )}

            {dirty && <p className="text-xs text-amber-700">Voorbeeld met gewijzigde cijfers, nog niet opgeslagen in het contract.</p>}
            <button
              onClick={createInvoice}
              disabled={Boolean(blocked) || busy}
              title={blocked || undefined}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              Factuur aanmaken voor {period.label}
            </button>
            {blocked && !preview.error && <p className="text-xs text-gray-500">{blocked}.</p>}
          </Card>

          <Card title={`Vergelijking per frequentie, ${year}, inclusief BTW`}>
            <div className="space-y-1">
              {compare.map((c) => (
                <div key={c.f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Calculator className="w-3.5 h-3.5 text-gray-400" />
                  <span className="w-20">{c.f}</span>
                  <span className="text-gray-500">{c.n} × {eur(c.per)}</span>
                  <span className="ml-auto tabular-nums font-medium text-gray-800">{eur(c.jaar)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Facturen van dit contract">
            {contractInvoices.length === 0 && <p className="text-sm text-gray-400">Nog geen facturen.</p>}
            <ul className="divide-y divide-gray-100">
              {contractInvoices.map((i) => (
                <li key={i.id} className="py-2 flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium text-gray-800">{i.periodLabel}</span>
                  <span className="tabular-nums text-gray-600">{eur(i.total)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[i.status]?.className}`}>{STATUS[i.status]?.label}</span>
                  {i.unit4Number && <span className="text-xs text-gray-500">{i.unit4Number}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {i.status === 'aangemaakt' && (
                      <button onClick={() => invoiceAction(i.id, 'send')} disabled={busy} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        <Send className="w-3.5 h-3.5" />
                        Naar Unit4
                      </button>
                    )}
                    {i.status !== 'geboekt' && (
                      <button onClick={() => removeInvoice(i.id)} disabled={busy} title="Verwijderen" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
