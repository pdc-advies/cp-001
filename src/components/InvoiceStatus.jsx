// Gedeeld door de factuurschermen
export const STATUS = {
  aangemaakt: { label: 'Concept', className: 'bg-gray-100 text-gray-700' },
  verzonden: { label: 'Verzonden naar Unit4', className: 'bg-amber-50 text-amber-800' },
  geboekt: { label: 'Geboekt', className: 'bg-blue-50 text-blue-700' },
  betaald: { label: 'Betaald', className: 'bg-green-50 text-green-700' },
}

export const eur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${s.className}`}>{s.label}</span>
}

export const invoiceKind = (i) => (i.creditOfId ? 'Creditfactuur' : i.type === 'belasting' ? 'Belasting' : 'Contract')
