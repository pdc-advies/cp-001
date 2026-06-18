import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'

// Periods per year by invoice frequency
const PERIODS = { Maand: 12, Kwartaal: 4, Jaar: 1, 'Ad Hoc': null }

function periodAmount(annualPrice, frequency) {
  const p = PERIODS[frequency]
  if (!p || !annualPrice) return null
  return annualPrice / p
}

function nlDate(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function eur(v) {
  if (v == null) return null
  return Math.round(v * 100) / 100
}

export async function GET() {
  const [contracts, customers] = await Promise.all([
    prisma.contract.findMany({ orderBy: [{ debiteurnummer: 'asc' }, { contractNumber: 'asc' }] }),
    prisma.customer.findMany(),
  ])

  const customerMap = {}
  for (const c of customers) customerMap[c.debiteurnummer] = c

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Contract Register'
  wb.created = new Date()

  // ─── Sheet 1: Factuurregels ───────────────────────────────────────────────
  const sheet = wb.addWorksheet('Unit4 Factuurregels')

  const cols = [
    { header: 'Debiteurnummer',     key: 'debiteurnummer',   width: 16 },
    { header: 'Klantnaam',          key: 'klantnaam',        width: 28 },
    { header: 'Contractnummer',     key: 'contractNumber',   width: 16 },
    { header: 'Type',               key: 'contractType',     width: 14 },
    { header: 'Status',             key: 'status',           width: 10 },
    { header: 'Referentie',         key: 'invoiceRef',       width: 32 },
    { header: 'Omschrijving',       key: 'description',      width: 45 },
    { header: 'Ingangsdatum fact.', key: 'invoiceStartDate', width: 18 },
    { header: 'Einddatum fact.',    key: 'invoiceEndDate',   width: 16 },
    { header: 'Frequentie',         key: 'invoiceFrequency', width: 12 },
    { header: 'Grootboek',          key: 'grootboekNieuw',        width: 12 },
    { header: 'Kostenplaats',       key: 'kostenplaats',     width: 14 },
    { header: 'BTW code',           key: 'btwCode',          width: 10 },
    { header: 'Oppervlakte (m²)',   key: 'm2',               width: 16 },
    { header: 'Prijs/m²',          key: 'pricePerM2',       width: 12 },
    { header: 'Jaarprijs',          key: 'jaarprijs',        width: 14 },
    { header: 'Periode bedrag',     key: 'periodeBedrag',    width: 15 },
    { header: 'Basisprijs/m²',     key: 'basePricePerM2',  width: 14 },
    { header: 'Basisjaar',          key: 'baseIndexYear',    width: 10 },
    { header: 'Index reeks',        key: 'indexSeries',      width: 12 },
    { header: 'Kadastrale',         key: 'kadastrale',       width: 20 },
  ]
  sheet.columns = cols

  // Header styling
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.height = 20

  const eurFmt = '#,##0.00'
  const numFmt = '#,##0.##'

  for (const c of contracts) {
    const customer = customerMap[c.debiteurnummer]
    const jaarprijs = c.m2 && c.pricePerM2 ? c.m2 * c.pricePerM2 : c.contractValue
    const periode = periodAmount(jaarprijs, c.invoiceFrequency)

    const row = sheet.addRow({
      debiteurnummer:   c.debiteurnummer ?? '',
      klantnaam:        customer?.name ?? '',
      contractNumber:   c.contractNumber,
      contractType:     c.contractType ?? '',
      status:           c.status,
      invoiceRef:       c.invoiceRef ?? '',
      description:      c.description ?? '',
      invoiceStartDate: nlDate(c.invoiceStartDate),
      invoiceEndDate:   nlDate(c.invoiceEndDate),
      invoiceFrequency: c.invoiceFrequency ?? '',
      grootboekNieuw:        c.grootboekNieuw ?? '',
      kostenplaats:     c.kostenplaats ?? '',
      btwCode:          c.btwCode ?? '',
      m2:               c.m2,
      pricePerM2:       eur(c.pricePerM2),
      jaarprijs:        eur(jaarprijs),
      periodeBedrag:    eur(periode),
      basePricePerM2:   eur(c.basePricePerM2),
      baseIndexYear:    c.baseIndexYear,
      indexSeries:      c.indexSeries ?? '',
      kadastrale:       c.kadastrale ?? '',
    })

    // Number formatting
    ;['m2'].forEach(k => {
      const cell = row.getCell(cols.findIndex(c => c.key === k) + 1)
      cell.numFmt = numFmt
    })
    ;['pricePerM2', 'jaarprijs', 'periodeBedrag', 'basePricePerM2'].forEach(k => {
      const cell = row.getCell(cols.findIndex(c => c.key === k) + 1)
      cell.numFmt = eurFmt
    })

    // Status colour coding
    if (c.status === 'active') {
      row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
    } else if (c.status === 'expired') {
      row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    }

    row.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
  }

  // Freeze top row + auto-filter
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + cols.length)}1` }

  // ─── Sheet 2: Samenvatting per debiteur ──────────────────────────────────
  const sum = wb.addWorksheet('Samenvatting')
  sum.columns = [
    { header: 'Debiteurnummer', key: 'deb',   width: 16 },
    { header: 'Klantnaam',      key: 'naam',  width: 28 },
    { header: 'Contracten',     key: 'count', width: 12 },
    { header: 'Actief',         key: 'actief',width: 10 },
    { header: 'Opp. m²',        key: 'm2',    width: 14 },
    { header: 'Jaarprijs',      key: 'jaar',  width: 16 },
    { header: 'Periode bedrag', key: 'per',   width: 16 },
    { header: 'Frequentie',     key: 'freq',  width: 12 },
  ]
  const sumHeader = sum.getRow(1)
  sumHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
  sumHeader.height = 20

  // Group by debiteur
  const groups = {}
  for (const c of contracts) {
    const key = c.debiteurnummer || '—'
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }

  for (const [deb, items] of Object.entries(groups).sort()) {
    const customer = customerMap[deb]
    const totalM2 = items.reduce((s, c) => s + (c.m2 || 0), 0)
    const totalJaar = items.reduce((s, c) => {
      const j = c.m2 && c.pricePerM2 ? c.m2 * c.pricePerM2 : (c.contractValue || 0)
      return s + j
    }, 0)
    const activeCount = items.filter(c => c.status === 'active').length
    // Use the most common frequency in the group
    const freqCounts = {}
    items.forEach(c => { if (c.invoiceFrequency) freqCounts[c.invoiceFrequency] = (freqCounts[c.invoiceFrequency] || 0) + 1 })
    const freq = Object.entries(freqCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    const totalPeriod = periodAmount(totalJaar, freq)

    const row = sum.addRow({
      deb,
      naam:  customer?.name ?? '',
      count: items.length,
      actief: activeCount,
      m2:    totalM2 || null,
      jaar:  eur(totalJaar) || null,
      per:   eur(totalPeriod),
      freq,
    })
    ;['m2'].forEach(() => { row.getCell('m2').numFmt = numFmt })
    ;['jaar', 'per'].forEach(k => { row.getCell(k).numFmt = eurFmt })
  }

  // Totals row
  const lastRow = sum.rowCount + 1
  const totalRow = sum.addRow({
    deb: 'TOTAAL',
    naam: '',
    count: contracts.length,
    actief: contracts.filter(c => c.status === 'active').length,
    m2: contracts.reduce((s, c) => s + (c.m2 || 0), 0),
    jaar: eur(contracts.reduce((s, c) => s + (c.m2 && c.pricePerM2 ? c.m2 * c.pricePerM2 : (c.contractValue || 0)), 0)),
    per: null,
    freq: '',
  })
  totalRow.font = { bold: true }
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
  ;['m2'].forEach(() => { totalRow.getCell('m2').numFmt = numFmt })
  ;['jaar'].forEach(k => { totalRow.getCell(k).numFmt = eurFmt })

  sum.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `unit4-export-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
