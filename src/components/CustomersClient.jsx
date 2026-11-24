'use client'

import { useState, useMemo, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import CustomerModal from './CustomerModal'
import SmartSearch, { useUrlQuery } from './SmartSearch'
import { searchRecords } from '@/lib/search'
import { customerSchema } from '@/lib/searchSchemas'

export default function CustomersClient({ initialCustomers }) {
  const [customers, setCustomers] = useState(initialCustomers)
  const [search, setSearch] = useUrlQuery()
  const [modal, setModal] = useState({ open: false, customer: null })
  const [deleting, setDeleting] = useState(null)

  const filtered = useMemo(
    () => searchRecords(customers, search, customerSchema).map(r => r.item),
    [customers, search]
  )

  const refresh = useCallback(async () => {
    const res = await fetch('/api/customers')
    if (res.ok) setCustomers(await res.json())
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Weet je zeker dat je deze klant wilt verwijderen?')) return
    setDeleting(id)
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      await refresh()
    } finally {
      setDeleting(null)
    }
  }

  const handleSave = async () => {
    setModal({ open: false, customer: null })
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Klanten</h1>
        <button
          onClick={() => setModal({ open: true, customer: null })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuwe klant
        </button>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <SmartSearch
          value={search}
          onChange={setSearch}
          schema={customerSchema}
          placeholder="Zoek: debiteurnummer, naam, plaats, e-mail…"
          resultCount={search ? filtered.length : null}
          className="flex-1 min-w-64 max-w-md"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Deb.nr (nieuw)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Deb.nr (oud)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Naam</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Adres</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Stad</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">E-mail</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Telefoon</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">Geen klanten gevonden</p>
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-gray-800">{c.debiteurnummer}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{c.debiteurnummerOud || '—'}</td>
                <td className="px-4 py-3 text-gray-700 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.address || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.city || '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.email ? <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a> : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      onClick={() => setModal({ open: true, customer: c })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Bewerken"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                      title="Verwijderen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'klant' : 'klanten'}
          </div>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal({ open: false, customer: null })} />
          <div className="relative w-full max-w-lg">
            <CustomerModal
              customer={modal.customer}
              onClose={() => setModal({ open: false, customer: null })}
              onSave={handleSave}
            />
          </div>
        </div>
      )}
    </div>
  )
}
