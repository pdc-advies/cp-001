'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, Plus, Download, Pencil, Trash2, FileText } from 'lucide-react'
import ContractModal from './ContractModal'

const STATUS_CONFIG = {
  active: {
    label: 'Actief',
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 ring-green-600/20'
  },
  expired: {
    label: 'Verlopen',
    dot: 'bg-gray-400',
    badge: 'bg-gray-50 text-gray-600 ring-gray-500/20'
  },
  draft: {
    label: 'Concept',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20'
  }
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${config.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export default function ContractsClient({ initialContracts }) {
  const [contracts, setContracts] = useState(initialContracts)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState({ open: false, contract: null })
  const [deleting, setDeleting] = useState(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return contracts.filter(c => {
      if (q && !(
        c.contractNumber.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.kostenplaats || '').toLowerCase().includes(q)
      )) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
  }, [contracts, search, statusFilter])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/contracts')
    if (res.ok) setContracts(await res.json())
  }, [])

  const openNew = () => setModal({ open: true, contract: null })
  const openEdit = (c) => setModal({ open: true, contract: c })
  const closeModal = () => setModal({ open: false, contract: null })

  const handleSave = async () => {
    closeModal()
    await refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Weet je zeker dat je dit contract wilt verwijderen?')) return
    setDeleting(id)
    try {
      await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
      await refresh()
    } finally {
      setDeleting(null)
    }
  }

  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalValue = activeContracts.reduce((sum, c) => sum + (c.contractValue || 0), 0)
  const draftCount = contracts.filter(c => c.status === 'draft').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Contracten</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuw contract
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-sm text-gray-500">Actieve contracten</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{activeContracts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-sm text-gray-500">Totale waarde (actief)</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-sm text-gray-500">Concepten</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{draftCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Zoeken op nummer, klant, omschrijving..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle statussen</option>
          <option value="active">Actief</option>
          <option value="expired">Verlopen</option>
          <option value="draft">Concept</option>
        </select>
        <a
          href="/api/contracts/export/excel"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </a>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Contract Nr</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Klant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Kostenplaats</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Startdatum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Einddatum</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Waarde</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-400 text-sm">Geen contracten gevonden</p>
                  </td>
                </tr>
              ) : (
                filtered.map(contract => (
                  <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {contract.contractNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{contract.customerName}</td>
                    <td className="px-4 py-3 text-gray-500">{contract.kostenplaats || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(contract.startDate)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(contract.endDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium whitespace-nowrap">
                      {formatCurrency(contract.contractValue)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => openEdit(contract)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Bewerken"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contract.id)}
                          disabled={deleting === contract.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'contract' : 'contracten'}
            {filtered.length !== contracts.length && ` van ${contracts.length} totaal`}
          </div>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-2xl">
            <ContractModal
              contract={modal.contract}
              onClose={closeModal}
              onSave={handleSave}
            />
          </div>
        </div>
      )}
    </div>
  )
}
