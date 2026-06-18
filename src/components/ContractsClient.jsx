'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Search, Plus, Download, Pencil, Trash2, FileText, Upload, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
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
  const [typeFilter, setTypeFilter] = useState('all')
  const [modal, setModal] = useState({ open: false, contract: null })
  const [deleting, setDeleting] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting_all, setDeletingAll] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  const fileInputRef = useRef(null)

  const contractTypes = useMemo(() => {
    const types = [...new Set(contracts.map(c => c.contractType).filter(Boolean))].sort()
    return types
  }, [contracts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return contracts.filter(c => {
      if (q && !(
        c.contractNumber.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.kostenplaats || '').toLowerCase().includes(q) ||
        (c.kadastrale || '').toLowerCase().includes(q) ||
        (c.debiteurnummer || '').toLowerCase().includes(q)
      )) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (typeFilter !== 'all' && c.contractType !== typeFilter) return false
      return true
    })
  }, [contracts, search, statusFilter, typeFilter])

  const grouped = useMemo(() => {
    const map = {}
    for (const c of filtered) {
      const key = c.debiteurnummer || '—'
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, 'nl'))
      .map(([debiteur, items]) => ({
        debiteur,
        contracts: [...items].sort((a, b) => a.contractNumber.localeCompare(b.contractNumber, 'nl')),
        totalM2: items.reduce((s, c) => s + (c.m2 || 0), 0),
        totalJaarprijs: items.reduce((s, c) =>
          s + (c.m2 != null && c.pricePerM2 != null ? c.m2 * c.pricePerM2 : c.contractValue || 0), 0)
      }))
  }, [filtered])

  const toggleGroup = (key) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
  const collapseAll = () => setCollapsed(new Set(grouped.map(g => g.debiteur)))
  const expandAll = () => setCollapsed(new Set())

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

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      await fetch('/api/contracts', { method: 'DELETE' })
      setContracts([])
    } finally {
      setDeletingAll(false)
      setDeleteConfirm(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/contracts/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import mislukt')
      setImportResult(data)
      await refresh()
    } catch (err) {
      setImportResult({ error: err.message })
    } finally {
      setImporting(false)
      e.target.value = ''
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
        {contractTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle typen</option>
            {contractTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <a
          href="/api/contracts/export/excel"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </a>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
        >
          <Upload className="w-4 h-4" />
          {importing ? 'Importeren...' : 'Import Excel'}
        </button>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Verwijder alles
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-50 border border-red-300 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="text-red-700 font-medium">Weet je het zeker?</span>
            <button
              onClick={handleDeleteAll}
              disabled={deleting_all}
              className="px-2 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-60"
            >
              {deleting_all ? 'Bezig...' : 'Ja, verwijder alles'}
            </button>
            <button onClick={() => setDeleteConfirm(false)} className="text-gray-500 hover:text-gray-700 text-xs underline">
              Annuleren
            </button>
          </div>
        )}
      </div>

      {importResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${importResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {importResult.error
            ? `Import fout: ${importResult.error}`
            : `Import klaar — ${importResult.created} aangemaakt, ${importResult.updated} bijgewerkt${importResult.failed ? `, ${importResult.failed} mislukt` : ''}`
          }
          <button onClick={() => setImportResult(null)} className="ml-3 underline opacity-70 hover:opacity-100">sluiten</button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {grouped.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-400">{grouped.length} debiteuren · {filtered.length} contracten</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={expandAll} className="text-xs text-blue-600 hover:underline">Alle uitklappen</button>
              <span className="text-gray-300">|</span>
              <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline">Alle inklappen</button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Contract Nr</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Kadastrale</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Startdatum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Einddatum</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">m²</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Prijs/m²</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Jaarprijs</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-400 text-sm">Geen contracten gevonden</p>
                  </td>
                </tr>
              ) : grouped.map(({ debiteur, contracts: groupContracts, totalM2, totalJaarprijs }) => {
                const isCollapsed = collapsed.has(debiteur)
                return (
                  <tbody key={debiteur}>
                    {/* Group header row */}
                    <tr
                      onClick={() => toggleGroup(debiteur)}
                      className="cursor-pointer bg-blue-50/40 hover:bg-blue-50 border-t border-blue-100 select-none"
                    >
                      <td colSpan={8} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isCollapsed
                            ? <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" />
                          }
                          <span className="font-semibold text-gray-800">{debiteur}</span>
                          <span className="text-gray-400 text-xs">
                            {groupContracts.length} {groupContracts.length === 1 ? 'contract' : 'contracten'}
                          </span>
                          {totalM2 > 0 && (
                            <span className="text-gray-400 text-xs">
                              · {new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(totalM2)} m²
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-700 whitespace-nowrap">
                        {totalJaarprijs > 0 ? formatCurrency(totalJaarprijs) : '—'}
                      </td>
                      <td />
                    </tr>
                    {/* Contract rows */}
                    {!isCollapsed && groupContracts.map(contract => (
                      <tr key={contract.id} className="hover:bg-gray-50 transition-colors border-t border-gray-100">
                        <td className="pl-10 pr-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                          {contract.contractNumber}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                          {contract.contractType || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                          {contract.kadastrale || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={contract.status} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(contract.startDate)}</td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(contract.endDate)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 whitespace-nowrap">
                          {contract.m2 != null
                            ? new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(contract.m2)
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 whitespace-nowrap">
                          {contract.pricePerM2 != null
                            ? new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(contract.pricePerM2)
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 font-medium whitespace-nowrap">
                          {contract.m2 != null && contract.pricePerM2 != null
                            ? formatCurrency(contract.m2 * contract.pricePerM2)
                            : formatCurrency(contract.contractValue)}
                        </td>
                        <td className="px-4 py-2.5">
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
                    ))}
                  </tbody>
                )
              })}
            </tbody>
          </table>
        </div>
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
