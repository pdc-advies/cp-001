'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const EMPTY_FORM = {
  contractNumber: '',
  customerName: '',
  kostenplaats: '',
  description: '',
  startDate: '',
  endDate: '',
  contractValue: '',
  m2: '',
  pricePerM2: '',
  priceIndex: '',
  status: 'draft',
  notes: ''
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

export default function ContractModal({ contract, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (contract) {
      setForm({
        contractNumber: contract.contractNumber || '',
        customerName: contract.customerName || '',
        kostenplaats: contract.kostenplaats || '',
        description: contract.description || '',
        startDate: contract.startDate
          ? new Date(contract.startDate).toISOString().split('T')[0]
          : '',
        endDate: contract.endDate
          ? new Date(contract.endDate).toISOString().split('T')[0]
          : '',
        contractValue: contract.contractValue ?? '',
        m2: contract.m2 ?? '',
        pricePerM2: contract.pricePerM2 ?? '',
        priceIndex: contract.priceIndex ?? '',
        status: contract.status || 'draft',
        notes: contract.notes || ''
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setError(null)
  }, [contract])

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

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
        endDate: form.endDate || null,
        kostenplaats: form.kostenplaats || null,
        description: form.description || null,
        notes: form.notes || null
      }
      const url = contract ? `/api/contracts/${contract.id}` : '/api/contracts'
      const res = await fetch(url, {
        method: contract ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Er is een fout opgetreden')
      }
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">
          {contract ? 'Contract bewerken' : 'Nieuw contract'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Contractnummer" required>
            <input
              type="text"
              required
              value={form.contractNumber}
              onChange={set('contractNumber')}
              placeholder="CNT-2025-001"
              className={inputClass}
            />
          </Field>
          <Field label="Klantnaam" required>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={set('customerName')}
              placeholder="Naam klant"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Kostenplaats">
          <input
            type="text"
            value={form.kostenplaats}
            onChange={set('kostenplaats')}
            placeholder="KP-100, KP-200"
            className={inputClass}
          />
        </Field>

        <Field label="Omschrijving">
          <textarea
            rows={2}
            value={form.description}
            onChange={set('description')}
            placeholder="Omschrijving van het contract..."
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Startdatum" required>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={set('startDate')}
              className={inputClass}
            />
          </Field>
          <Field label="Einddatum">
            <input
              type="date"
              value={form.endDate}
              onChange={set('endDate')}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Oppervlakte (m²)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.m2}
              onChange={set('m2')}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="Prijs per m² (€)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.pricePerM2}
              onChange={set('pricePerM2')}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="Index">
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.priceIndex}
              onChange={set('priceIndex')}
              placeholder="bv. 1.05"
              className={inputClass}
            />
          </Field>
        </div>

        {(form.m2 !== '' && form.pricePerM2 !== '') && (() => {
          const m2 = parseFloat(form.m2) || 0
          const ppm2 = parseFloat(form.pricePerM2) || 0
          const idx = parseFloat(form.priceIndex) || null
          const base = m2 * ppm2
          const indexed = idx ? base * idx : null
          return (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-blue-700">Basisprijs (m² × prijs/m²)</span>
                <span className="font-semibold text-blue-900">
                  {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(base)}
                </span>
              </div>
              {indexed != null && (
                <div className="flex justify-between">
                  <span className="text-blue-700">Geïndexeerde prijs (× {form.priceIndex})</span>
                  <span className="font-semibold text-blue-900">
                    {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(indexed)}
                  </span>
                </div>
              )}
            </div>
          )
        })()}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Waarde (€)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.contractValue}
              onChange={set('contractValue')}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className={inputClass}>
              <option value="draft">Concept</option>
              <option value="active">Actief</option>
              <option value="expired">Verlopen</option>
            </select>
          </Field>
        </div>

        <Field label="Notities">
          <textarea
            rows={2}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Aanvullende opmerkingen..."
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Opslaan...' : contract ? 'Opslaan' : 'Aanmaken'}
          </button>
        </div>
      </form>
    </div>
  )
}
