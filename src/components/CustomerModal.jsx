'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const EMPTY = {
  debiteurnummer: '', name: '', address: '', city: '', email: '', phone: '', notes: ''
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setForm(customer ? {
      debiteurnummer: customer.debiteurnummer || '',
      name: customer.name || '',
      address: customer.address || '',
      city: customer.city || '',
      email: customer.email || '',
      phone: customer.phone || '',
      notes: customer.notes || '',
    } : EMPTY)
    setError(null)
  }, [customer])

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = customer ? `/api/customers/${customer.id}` : '/api/customers'
      const res = await fetch(url, {
        method: customer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          address: form.address || null,
          city: form.city || null,
          email: form.email || null,
          phone: form.phone || null,
          notes: form.notes || null,
        })
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Fout bij opslaan')
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
          {customer ? 'Klant bewerken' : 'Nieuwe klant'}
        </h2>
        <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Debiteurnummer" required>
            <input type="text" required value={form.debiteurnummer} onChange={set('debiteurnummer')} placeholder="800310" className={inputClass} />
          </Field>
          <Field label="Naam" required>
            <input type="text" required value={form.name} onChange={set('name')} placeholder="Bedrijfsnaam" className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Adres">
            <input type="text" value={form.address} onChange={set('address')} placeholder="Straatnaam 1" className={inputClass} />
          </Field>
          <Field label="Stad">
            <input type="text" value={form.city} onChange={set('city')} placeholder="Rotterdam" className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="E-mail">
            <input type="email" value={form.email} onChange={set('email')} placeholder="info@bedrijf.nl" className={inputClass} />
          </Field>
          <Field label="Telefoon">
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+31 10 000 0000" className={inputClass} />
          </Field>
        </div>

        <Field label="Notities">
          <textarea rows={2} value={form.notes} onChange={set('notes')} className={`${inputClass} resize-none`} />
        </Field>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Annuleren
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Opslaan...' : customer ? 'Opslaan' : 'Aanmaken'}
          </button>
        </div>
      </form>
    </div>
  )
}
