'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Send, Trash2, ExternalLink } from 'lucide-react'
import { BELASTINGEN, FREQUENTIES, annualPrice, berekenOZB, buildInvoice, buildTaxInvoice, contractLiepIn, periodsFor } from '@/lib/invoicing'
import { BASISTARIEF, COEFFICIENTEN, berekenOV, opcentiemenVoorJaar } from '@/lib/onroerendeVoorheffing'
import { parseKadastrale } from '@/lib/kadastrale'
import { StatusBadge, eur, fmtDate, invoiceKind } from '@/components/InvoiceStatus'

const SIMULATOR_URL = 'https://belastingen.fenb.be/ui/public/simulaties/ov'
const JAREN = [2025, 2026, 2027]
const AANSLAGJAREN = Object.keys(COEFFICIENTEN).map(Number).reverse()
const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">{title}</h3>
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

// Facturatie van één contract: wat het contract oplevert, de facturen en de ontvangen belastingaanslagen.
// Rekent met de opgeslagen contractgegevens; wijzigen gebeurt in het formulier hierboven.
export default function ContractBilling({ contract, btwCodes }) {
  const [invoices, setInvoices] = useState(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [index, setIndex] = useState(0)
  const [taxYear, setTaxYear] = useState(AANSLAGJAREN[0])
  const [tax, setTax] = useState({ amount: '', receivedAt: new Date().toISOString().slice(0, 10), reference: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices?contractId=${contract.id}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    setInvoices(json)
  }, [contract.id])

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [load])

  const act = async (url, method, body) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error || 'Er ging iets mis')
      await load()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const btwPercentage = btwCodes.find((b) => b.code === contract.btwCode)?.percentage
  const frequency = contract.invoiceFrequency in FREQUENTIES ? contract.invoiceFrequency : null
  const periods = frequency ? periodsFor(frequency, year) : []
  const period = periods[Math.min(index, periods.length - 1)]
  const preview = period ? buildInvoice(contract, period, btwPercentage) : null
  const jaarprijs = annualPrice(contract)

  const isBE = parseKadastrale(contract.kadastrale).some((p) => p.land === 'BE') || contract.kadastraalInkomen != null
  const taxType = isBE ? 'OV' : 'OZB'
  const tarief = opcentiemenVoorJaar(contract, taxYear)
  const ov = isBE
    ? berekenOV({ kadastraalInkomen: contract.kadastraalInkomen, jaar: taxYear, opcentiemenGemeente: tarief.gemeente, opcentiemenProvincie: tarief.provincie })
    : null
  const berekend = isBE ? (ov?.totaal ?? null) : berekenOZB(contract)
  const lopend = (y) => invoices?.find((i) => i.type === 'belasting' && i.taxYear === y && !i.creditOfId && !i.credited)
  const gecorrigeerd = (y) => invoices?.some((i) => i.creditOfId && i.taxYear === y)
  const bestaand = lopend(taxYear)
  const corrigeert = ['geboekt', 'betaald'].includes(bestaand?.status)
  const taxPreview = buildTaxInvoice(contract, { taxType, year: taxYear, amount: tax.amount }, btwPercentage)
  const verschil = tax.amount !== '' && berekend != null ? Number(tax.amount) - berekend : null
  const zelfdeBedrag = corrigeert && Number(tax.amount) === bestaand.subtotal

  const createTax = async () => {
    const ok = await act('/api/invoices', 'POST', { type: 'belasting', contractId: contract.id, taxType, taxYear, ...tax, corrects: corrigeert ? bestaand.id : undefined })
    if (ok) setTax((t) => ({ ...t, amount: '', reference: '' }))
  }

  return (
    <section id="facturatie" className="space-y-4 scroll-mt-20">
      <h2 className="text-lg font-semibold text-gray-900">Facturatie</h2>
      {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card title="Volgens het contract">
          <div className="space-y-1">
            <Row label="Jaarbedrag" value={jaarprijs == null ? 'Geen prijs' : eur(jaarprijs)} />
            <Row label="Frequentie" value={frequency ?? 'Niet ingesteld'} />
            <Row label="BTW" value={contract.btwCode ? `${contract.btwCode} (${btwPercentage ?? 0}%)` : 'Geen'} />
          </div>
          {frequency ? (
            <>
              <p className="text-xs text-gray-500">Contractfacturen komen normaal uit de <Link href="/facturatie" className="text-blue-600 hover:underline">factuurrun</Link>. Een losse factuur voor één periode kan ook hier.</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass}>
                  {JAREN.map((y) => <option key={y}>{y}</option>)}
                </select>
                <select value={period.index} onChange={(e) => setIndex(Number(e.target.value))} disabled={periods.length === 1} className={inputClass}>
                  {periods.map((p) => <option key={p.index} value={p.index}>{p.label}</option>)}
                </select>
              </div>
              {preview?.error ? (
                <p className="text-xs text-amber-700">{preview.error}.</p>
              ) : (
                <Row label={`${period.label}, inclusief BTW${preview.factor < 1 ? ` (pro rata ${Math.round(preview.factor * 100)}%)` : ''}`} value={eur(preview.total)} strong />
              )}
              <button
                onClick={() => act('/api/invoices', 'POST', { contractId: contract.id, year, index: period.index })}
                disabled={busy || Boolean(preview?.error) || contract.status === 'draft'}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Conceptfactuur {period.label}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-700">Stel een frequentie in om dit contract te factureren.</p>
          )}
        </Card>

        <Card title={`Belastingaanslag ontvangen: ${BELASTINGEN[taxType].label}`}>
          <p className="text-xs text-gray-500">Aparte factuur zodra de aanslag van de overheid binnen is, volledig doorbelast. Ook voor oudere aanslagjaren.</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {AANSLAGJAREN.filter((y) => contractLiepIn(contract, y)).map((y) => {
              const inv = lopend(y)
              return (
                <li key={y}>
                  <button type="button" onClick={() => setTaxYear(y)} className={`w-full flex justify-between gap-2 px-2 py-1 rounded-md hover:bg-gray-50 ${y === taxYear ? 'bg-blue-50' : ''}`}>
                    <span className="font-medium text-gray-700">{y}</span>
                    <span className={inv ? 'text-green-700' : 'text-gray-400'}>
                      {inv ? eur(inv.subtotal) : 'Geen aanslag'}{gecorrigeerd(y) && ' (gecorrigeerd)'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-500">Aanslagjaar
              <select value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))} className={inputClass}>
                {AANSLAGJAREN.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-500">Ontvangen op
              <input type="date" value={tax.receivedAt} onChange={(e) => setTax((t) => ({ ...t, receivedAt: e.target.value }))} className={inputClass} />
            </label>
            <label className="text-xs font-medium text-gray-500">Bedrag op de aanslag (€)
              <input type="number" step="0.01" min="0" value={tax.amount} onChange={(e) => setTax((t) => ({ ...t, amount: e.target.value }))} className={inputClass} />
            </label>
            <label className="text-xs font-medium text-gray-500">Aanslagnummer
              <input type="text" value={tax.reference} onChange={(e) => setTax((t) => ({ ...t, reference: e.target.value }))} className={inputClass} />
            </label>
          </div>

          {isBE && ov && (
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer">Controleberekening {taxYear}: {eur(ov.totaal)}</summary>
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                <Row label={`KI ${eur(contract.kadastraalInkomen)} × ${ov.coefficient.toLocaleString('nl-NL', { minimumFractionDigits: 4 })}`} value={eur(ov.geindexeerdKI)} />
                <Row label={`Basisheffing ${(BASISTARIEF * 100).toLocaleString('nl-NL')}%`} value={eur(ov.basisheffing)} />
                <Row label={`Provincie (${tarief.provincie})`} value={eur(ov.provincie)} />
                <Row label={`Gemeente (${tarief.gemeente})`} value={eur(ov.gemeente)} />
              </div>
              {tarief.ontbreekt && <p className="mt-1 text-amber-700">Geen tarief voor {taxYear} bekend (fusiegemeente): het contracttarief is gebruikt.</p>}
              <a href={SIMULATOR_URL} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline">
                Officiële simulator <ExternalLink className="w-3 h-3" />
              </a>
            </details>
          )}
          {berekend != null && (
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                Berekend: {eur(berekend)}
                {verschil != null && Math.abs(verschil) >= 0.01 && <span className="text-amber-700"> · verschil met aanslag {eur(verschil)}</span>}
              </span>
              <button type="button" onClick={() => setTax((t) => ({ ...t, amount: berekend }))} className="text-blue-600 hover:underline">Overnemen</button>
            </div>
          )}
          {berekend == null && <p className="text-xs text-gray-400">Geen controleberekening: vul de grondslag in het contractformulier in.</p>}

          {!taxPreview.error && <Row label={`Factuur inclusief BTW (${btwPercentage ?? 0}%)`} value={eur(taxPreview.total)} strong />}
          {tax.amount !== '' && taxPreview.error && <p className="text-xs text-amber-700">{taxPreview.error}.</p>}
          {bestaand && !corrigeert && <p className="text-xs text-amber-700">Aanslagjaar {taxYear} staat al als {bestaand.status === 'aangemaakt' ? 'concept' : 'verzonden factuur'} klaar.</p>}
          {corrigeert && <p className="text-xs text-amber-700">Aanslagjaar {taxYear} is geboekt voor {eur(bestaand.subtotal)}. Een nieuw bedrag geeft een creditfactuur en een nieuwe factuur.</p>}
          <button
            onClick={createTax}
            disabled={busy || Boolean(taxPreview.error) || (bestaand && !corrigeert) || zelfdeBedrag || contract.status === 'draft'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {corrigeert ? `Corrigeren: credit en nieuwe factuur ${taxYear}` : `Conceptfactuur aanslag ${taxYear}`}
          </button>
        </Card>
      </div>

      <Card title="Facturen van dit contract">
        {invoices?.length === 0 && <p className="text-sm text-gray-400">Nog geen facturen.</p>}
        {invoices?.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-200">
                <th className="py-1.5 text-left font-medium">Soort</th>
                <th className="py-1.5 text-left font-medium">Omschrijving</th>
                <th className="py-1.5 text-left font-medium">Status</th>
                <th className="py-1.5 text-left font-medium">Nummer</th>
                <th className="py-1.5 text-right font-medium">Totaal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-gray-100">
                  <td className="py-2 text-xs text-gray-500">{invoiceKind(i)}</td>
                  <td className="py-2"><Link href={`/facturen/${i.id}`} className="text-blue-700 hover:underline">{i.periodLabel}</Link></td>
                  <td className="py-2"><StatusBadge status={i.status} />{i.credited && <span className="ml-1 text-xs text-gray-400">gecrediteerd</span>}</td>
                  <td className="py-2 text-xs text-gray-500">{i.unit4Number ?? '—'}{i.dueDate && i.status !== 'betaald' && ` · vervalt ${fmtDate(i.dueDate)}`}</td>
                  <td className="py-2 text-right tabular-nums">{eur(i.total)}</td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    {i.status === 'aangemaakt' && (
                      <>
                        <button onClick={() => act(`/api/invoices/${i.id}`, 'PATCH', { action: 'send' })} disabled={busy} title="Versturen naar Unit4" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-40">
                          <Send className="w-4 h-4" />
                        </button>
                        {!i.creditOfId && (
                          <button onClick={() => act(`/api/invoices/${i.id}`, 'DELETE')} disabled={busy} title="Concept verwijderen" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-40">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  )
}
