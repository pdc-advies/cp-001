'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

function Field({ label, children }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  )
}

function formatCurrency(v) {
  if (!v) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)
}

export default function ContractEditForm({ contract, customers, btwCodes = [] }) {
  const router = useRouter()

  const [form, setForm] = useState({
    contractNumber: contract.contractNumber ?? '',
    contractType: contract.contractType ?? '',
    status: contract.status ?? 'draft',
    debiteurnummer: contract.debiteurnummer ?? '',
    kostenplaats: contract.kostenplaats ?? '',
    invoiceFrequency: contract.invoiceFrequency ?? '',
    manager: contract.manager ?? '',
    kadastrale: contract.kadastrale ?? '',
    description: contract.description ?? '',
    startDate: contract.startDate ?? '',
    endDate: contract.endDate ?? '',
    invoiceStartDate: contract.invoiceStartDate ?? '',
    invoiceEndDate: contract.invoiceEndDate ?? '',
    m2: contract.m2 ?? '',
    pricePerM2: contract.pricePerM2 ?? '',
    basePricePerM2: contract.basePricePerM2 ?? '',
    baseIndexYear: contract.baseIndexYear ?? '',
    indexSeries: contract.indexSeries ?? '',
    priceIndex: contract.priceIndex ?? '',
    contractValue: contract.contractValue ?? '',
    grootboekNieuw: contract.grootboekNieuw ?? '',
    grootboekOud: contract.grootboekOud ?? '',
    btwCode: contract.btwCode ?? '',
    invoiceRef: contract.invoiceRef ?? '',
    notes: contract.notes ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  // Customer lookup
  const customerMap = useMemo(() => {
    const m = {}
    for (const c of customers) {
      m[c.debiteurnummer] = c
      if (c.debiteurnummerOud) m[c.debiteurnummerOud] = c
    }
    return m
  }, [customers])

  const matchedCustomer = customerMap[form.debiteurnummer]

  // Live price calculation
  const m2Val = parseFloat(form.m2) || 0
  const ppmVal = parseFloat(form.pricePerM2) || 0
  const idxVal = parseFloat(form.priceIndex) || null
  const basePrice = m2Val && ppmVal ? m2Val * ppmVal : null
  const indexedPrice = basePrice && idxVal ? basePrice * idxVal : null

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        ...form,
        contractValue: form.contractValue !== '' ? parseFloat(form.contractValue) : null,
        m2: form.m2 !== '' ? parseFloat(form.m2) : null,
        pricePerM2: form.pricePerM2 !== '' ? parseFloat(form.pricePerM2) : null,
        priceIndex: form.priceIndex !== '' ? parseFloat(form.priceIndex) : null,
        basePricePerM2: form.basePricePerM2 !== '' ? parseFloat(form.basePricePerM2) : null,
        baseIndexYear: form.baseIndexYear !== '' ? parseInt(form.baseIndexYear) : null,
        endDate: form.endDate || null,
        invoiceStartDate: form.invoiceStartDate || null,
        invoiceEndDate: form.invoiceEndDate || null,
        kostenplaats: form.kostenplaats || null,
        contractType: form.contractType || null,
        invoiceFrequency: form.invoiceFrequency || null,
        manager: form.manager || null,
        debiteurnummer: form.debiteurnummer || null,
        kadastrale: form.kadastrale || null,
        indexSeries: form.indexSeries || null,
        description: form.description || null,
        grootboekNieuw: form.grootboekNieuw || null,
        grootboekOud: form.grootboekOud || null,
        btwCode: form.btwCode || null,
        invoiceRef: form.invoiceRef || null,
        notes: form.notes || null,
        customerName: matchedCustomer?.name ?? form.debiteurnummer ?? contract.customerName,
      }
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Fout bij opslaan')
      }
      router.push('/')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contract bewerken</h1>
          <p className="text-sm text-gray-400">{contract.contractNumber}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => router.push('/')} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identificatie */}
        <Section title="Identificatie">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Entity code">
              <input type="text" value={form.contractNumber} onChange={set('contractNumber')} className={inputClass} />
            </Field>
            <Field label="Type contract">
              <input type="text" value={form.contractType} onChange={set('contractType')} placeholder="Erfpacht, Huur…" className={inputClass} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set('status')} className={inputClass}>
                <option value="draft">Concept</option>
                <option value="active">Actief</option>
                <option value="expired">Verlopen</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Klant */}
        <Section title="Klant">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Field label="Debiteurnummer">
                <input
                  type="text"
                  value={form.debiteurnummer}
                  onChange={set('debiteurnummer')}
                  list="customer-list"
                  placeholder="800310"
                  className={inputClass}
                />
                <datalist id="customer-list">
                  {customers.map(c => (
                    <option key={c.id} value={c.debiteurnummer}>{c.name}</option>
                  ))}
                </datalist>
              </Field>
              {matchedCustomer && (
                <p className="mt-1 text-xs text-green-700 font-medium">{matchedCustomer.name}</p>
              )}
            </div>
            <Field label="Kostenplaats">
              <input type="text" value={form.kostenplaats} onChange={set('kostenplaats')} className={inputClass} />
            </Field>
            <Field label="Frequentie">
              <select value={form.invoiceFrequency} onChange={set('invoiceFrequency')} className={inputClass}>
                <option value="">—</option>
                <option>Maand</option>
                <option>Kwartaal</option>
                <option>Jaar</option>
                <option>Ad Hoc</option>
              </select>
            </Field>
          </div>
          <Field label="Manager">
            <input type="text" value={form.manager} onChange={set('manager')} className={`${inputClass} max-w-xs`} />
          </Field>
        </Section>

        {/* Locatie */}
        <Section title="Locatie">
          <Field label="Kadastrale notatie">
            <input type="text" value={form.kadastrale} onChange={set('kadastrale')} className={`${inputClass} max-w-sm`} />
          </Field>
          <Field label="Omschrijving">
            <textarea rows={2} value={form.description} onChange={set('description')} className={`${inputClass} resize-none`} />
          </Field>
        </Section>

        {/* Datums */}
        <Section title="Datums">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Startdatum contract">
              <input type="date" value={form.startDate} onChange={set('startDate')} className={inputClass} />
            </Field>
            <Field label="Einddatum contract">
              <input type="date" value={form.endDate} onChange={set('endDate')} className={inputClass} />
            </Field>
            <Field label="Afwijkende ingangsdatum factuur">
              <input type="date" value={form.invoiceStartDate} onChange={set('invoiceStartDate')} className={inputClass} />
            </Field>
            <Field label="Afwijkende einddatum factuur">
              <input type="date" value={form.invoiceEndDate} onChange={set('invoiceEndDate')} className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* Boekhoudkundige gegevens */}
        <Section title="Boekhoudkundige gegevens">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Grootboek nieuw">
              <input type="text" value={form.grootboekNieuw} onChange={set('grootboekNieuw')} placeholder="82000" className={inputClass} />
            </Field>
            <Field label="Grootboek oud">
              <input type="text" value={form.grootboekOud} onChange={set('grootboekOud')} placeholder="oud rekeningnummer" className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="BTW code">
              <input
                type="text"
                value={form.btwCode}
                onChange={set('btwCode')}
                list="btw-list"
                placeholder="bijv. 0, V21, vrijgesteld"
                className={inputClass}
              />
              <datalist id="btw-list">
                {btwCodes.map(b => (
                  <option key={b.id} value={b.code}>{b.code} — {b.description}{b.percentage != null ? ` (${b.percentage}%)` : ''}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Referentie factuur">
              <input type="text" value={form.invoiceRef} onChange={set('invoiceRef')} placeholder="Erfpacht #Ke kwartaal #J" className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* Financieel */}
        <Section title="Financieel">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Oppervlakte (m²)">
              <input type="number" step="0.01" min="0" value={form.m2} onChange={set('m2')} className={inputClass} />
            </Field>
            <Field label="Jaarprijs per m² (€)">
              <input type="number" step="0.0001" min="0" value={form.pricePerM2} onChange={set('pricePerM2')} className={inputClass} />
            </Field>
            <Field label="Index factor">
              <input type="number" step="0.0001" min="0" value={form.priceIndex} onChange={set('priceIndex')} placeholder="bv. 1.05" className={inputClass} />
            </Field>
            <Field label="Basisprijs/m² (€)">
              <input type="number" step="0.0001" min="0" value={form.basePricePerM2} onChange={set('basePricePerM2')} className={inputClass} />
            </Field>
            <Field label="Basisjaar index">
              <input type="number" step="1" min="1900" max="2100" value={form.baseIndexYear} onChange={set('baseIndexYear')} placeholder="2016" className={inputClass} />
            </Field>
            <Field label="Reeks (bijv. CPI)">
              <input type="text" value={form.indexSeries} onChange={set('indexSeries')} placeholder="CPI" className={inputClass} />
            </Field>
          </div>

          {basePrice != null && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-blue-700">Basisprijs (m² × prijs/m²)</span>
                <span className="font-semibold text-blue-900">{formatCurrency(basePrice)}</span>
              </div>
              {indexedPrice && (
                <div className="flex justify-between">
                  <span className="text-blue-700">Geïndexeerde prijs (× {form.priceIndex})</span>
                  <span className="font-semibold text-blue-900">{formatCurrency(indexedPrice)}</span>
                </div>
              )}
            </div>
          )}

          <Field label="Contractwaarde (€) — handmatig overschrijven">
            <input type="number" step="0.01" min="0" value={form.contractValue} onChange={set('contractValue')} className={`${inputClass} max-w-xs`} />
          </Field>
        </Section>

        {/* Notities */}
        <Section title="Notities">
          <textarea rows={4} value={form.notes} onChange={set('notes')} className={`${inputClass} resize-none`} />
        </Section>
      </form>
    </div>
  )
}
