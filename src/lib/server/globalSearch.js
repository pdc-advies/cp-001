// Globaal zoeken over de hele database met dezelfde zoektaal als de schermen (src/lib/search.js).
// Een groep doet alleen mee als die de hele zoekopdracht begrijpt: "ov 2024" zoekt dus niet in klanten.
import { prisma } from '@/lib/prisma'
import { isDemo } from '@/lib/demo'
import { parseQuery, matchRecord } from '@/lib/search'
import { contractSchema, customerSchema, invoiceSchema, messageSchema, noteSchema, unit4Schema } from '@/lib/searchSchemas'
import { annualPrice } from '@/lib/invoicing'

const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ?? null)
const eur = (v) => (v == null ? '' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v))
const STATUS_NL = { active: 'Actief', expired: 'Verlopen', draft: 'Concept' }
const plain = (o) => JSON.parse(JSON.stringify(o))

function run(records, query, schema, limit, toItem) {
  const parsed = parseQuery(query, schema)
  if (!parsed.text.length && !parsed.filters.length) return null
  if (parsed.chips.some((c) => !c.supported)) return null
  const items = []
  let total = 0
  for (const r of records) {
    const hit = matchRecord(r, parsed, schema)
    if (!hit) continue
    total++
    if (items.length < limit) items.push({ ...toItem(r), notes: hit.notes })
  }
  return total ? { total, items } : null
}

export async function globalSearch(query, { limit = 8 } = {}) {
  const demo = isDemo()
  const [contracts, customers, notes, invoices, unit4, messages] = await Promise.all([
    prisma.contract.findMany({ orderBy: { contractNumber: 'asc' } }),
    prisma.customer.findMany({ orderBy: { debiteurnummer: 'asc' } }),
    prisma.contractNote.findMany({ orderBy: { createdAt: 'desc' }, include: { contract: { select: { contractNumber: true } } } }),
    demo ? prisma.invoice.findMany({ orderBy: { id: 'desc' } }) : [],
    demo ? prisma.unit4Invoice.findMany({ orderBy: { id: 'desc' } }) : [],
    demo ? prisma.interfaceMessage.findMany({ orderBy: { id: 'desc' }, take: 2000 }) : [],
  ])

  const klant = {}
  for (const k of customers) {
    klant[k.debiteurnummer] = k
    if (k.debiteurnummerOud) klant[k.debiteurnummerOud] = k
  }
  const contractRecords = contracts.map((c) => ({
    ...c,
    startDate: day(c.startDate),
    endDate: day(c.endDate),
    invoiceStartDate: day(c.invoiceStartDate),
    invoiceEndDate: day(c.invoiceEndDate),
    klantNaam: klant[c.debiteurnummer]?.name ?? null,
  }))

  const groups = []
  const add = (key, label, result) => result && groups.push({ key, label, ...result })

  add('contracten', 'Contracten', run(contractRecords, query, contractSchema, limit, (c) => ({
    id: c.id,
    title: c.contractNumber,
    subtitle: [c.klantNaam ?? c.customerName, c.contractType, STATUS_NL[c.status], eur(annualPrice(c))].filter(Boolean).join(' · '),
    href: `/contracts/${c.id}`,
  })))
  add('klanten', 'Klanten', run(customers, query, customerSchema, limit, (k) => ({
    id: k.id,
    title: `${k.debiteurnummer} ${k.name}`,
    subtitle: [k.address, k.city, k.email].filter(Boolean).join(' · '),
    href: `/customers?q=${encodeURIComponent(k.debiteurnummer)}`,
  })))
  add('notities', 'Notities en acties', run(notes.map((n) => ({ ...plain(n), contractNumber: n.contract?.contractNumber })), query, noteSchema, limit, (n) => ({
    id: n.id,
    title: `${n.contractNumber} · ${n.text.length > 80 ? `${n.text.slice(0, 80)}…` : n.text}`,
    subtitle: [n.author, day(n.createdAt), n.team && (n.doneAt ? `actie ${n.team} afgerond` : `open actie ${n.team}`)].filter(Boolean).join(' · '),
    href: `/contracts/${n.contractId}`,
  })))
  if (demo) {
    add('facturen', 'Terugvorderen Grondgebonden Heffingen: facturen', run(plain(invoices), query, invoiceSchema, limit, (i) => ({
      id: i.id,
      title: `${i.unit4Number ?? `CP001-${i.id}`} · ${i.contractNumber}`,
      subtitle: [i.type === 'belasting' ? `${i.taxType} ${i.taxYear}` : i.periodLabel, i.status, eur(i.total)].filter(Boolean).join(' · '),
      href: `/facturen/${i.id}`,
    })))
    add('unit4', 'Unit4 (simulatie)', run(plain(unit4), query, unit4Schema, limit, (r) => ({
      id: r.id,
      title: `${r.number ?? r.externalId} · ${r.payload.invoice.contract?.number ?? ''}`,
      subtitle: [r.payload.invoice.customer?.name, r.status, eur(r.payload.invoice.totals?.gross)].filter(Boolean).join(' · '),
      href: `/unit4?q=${encodeURIComponent(r.number ?? r.externalId)}`,
    })))
    add('berichten', 'Koppelingen: berichten', run(plain(messages), query, messageSchema, limit, (m) => ({
      id: m.id,
      title: `${m.operation} · ${m.httpStatus}`,
      subtitle: [m.direction.replaceAll('CP-001', 'Contractenportaal'), day(m.createdAt), m.invoiceId && `CP001-${m.invoiceId}`].filter(Boolean).join(' · '),
      href: `/koppelingen?q=${encodeURIComponent(query)}`,
    })))
  }
  return { query, groups }
}
