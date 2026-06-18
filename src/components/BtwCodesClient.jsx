'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Percent } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

function Modal({ code, onClose, onSave }) {
  const [form, setForm] = useState({
    code: code?.code ?? '',
    description: code?.description ?? '',
    percentage: code?.percentage ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = code ? `/api/btw-codes/${code.id}` : '/api/btw-codes'
      const res = await fetch(url, {
        method: code ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          description: form.description,
          percentage: form.percentage !== '' ? parseFloat(form.percentage) : null,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      onSave()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{code ? 'BTW code bewerken' : 'Nieuwe BTW code'}</h2>
        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code *</label>
              <input required type="text" value={form.code} onChange={set('code')} placeholder="V21" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Percentage (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={form.percentage} onChange={set('percentage')} placeholder="21" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Omschrijving *</label>
            <input required type="text" value={form.description} onChange={set('description')} placeholder="Hoog tarief 21%" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuleren</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Opslaan...' : code ? 'Opslaan' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BtwCodesClient({ initialCodes }) {
  const [codes, setCodes] = useState(initialCodes)
  const [modal, setModal] = useState({ open: false, code: null })
  const [deleting, setDeleting] = useState(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/btw-codes')
    if (res.ok) setCodes(await res.json())
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('BTW code verwijderen?')) return
    setDeleting(id)
    try { await fetch(`/api/btw-codes/${id}`, { method: 'DELETE' }); await refresh() }
    finally { setDeleting(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">BTW Codes</h1>
        <button
          onClick={() => setModal({ open: true, code: null })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Nieuwe BTW code
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Omschrijving</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Percentage</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {codes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <Percent className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">Nog geen BTW codes aangemaakt</p>
                </td>
              </tr>
            ) : codes.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{c.code}</td>
                <td className="px-4 py-3 text-gray-700">{c.description}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {c.percentage != null ? `${c.percentage}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <button onClick={() => setModal({ open: true, code: c })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Bewerken">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40" title="Verwijderen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {codes.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            {codes.length} {codes.length === 1 ? 'code' : 'codes'}
          </div>
        )}
      </div>

      {modal.open && (
        <Modal
          code={modal.code}
          onClose={() => setModal({ open: false, code: null })}
          onSave={async () => { setModal({ open: false, code: null }); await refresh() }}
        />
      )}
    </div>
  )
}
