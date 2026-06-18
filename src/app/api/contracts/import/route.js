import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return isNaN(val) ? null : val
  const s = String(val).trim()
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
  const d = new Date(s)
  return isNaN(d) ? null : d
}

function parseNum(val) {
  if (val == null || val === '') return null
  const n = parseFloat(String(val).replace(',', '.').replace(/[^\d.-]/g, ''))
  return isNaN(n) ? null : n
}

function toStr(val) {
  if (val == null || val === '') return null
  const s = String(val).trim()
  return s === '' ? null : s
}

function mapStatus(val) {
  if (!val) return 'draft'
  const s = String(val).toLowerCase().trim()
  if (s === 'lopend' || s === 'vernieuwen') return 'active'
  if (s.startsWith('beindig') || s.startsWith('beëindig')) return 'expired'
  return 'draft'
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Geen bestand meegegeven' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]

    // Build header→column index map from row 3
    const colMap = {}
    sheet.getRow(3).eachCell((cell, col) => {
      if (cell.value) colMap[String(cell.value).trim()] = col
    })

    const get = (row, key) => {
      const col = colMap[key]
      return col ? row.getCell(col).value : null
    }

    let created = 0, updated = 0, failed = 0
    const failedCodes = []

    for (let i = 4; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i)
      const entityCode = toStr(get(row, 'entity code'))
      if (!entityCode || entityCode === 'Total') continue

      const startDate = parseDate(get(row, '22VAN'))
      if (!startDate) continue

      const m2 = parseNum(get(row, '73OPP'))
      const pricePerM2 = parseNum(get(row, '77PRIJS'))
      const contractValue = m2 != null && pricePerM2 != null ? m2 * pricePerM2 : null

      const oms = [get(row, '61OMS'), get(row, '62OMS2'), get(row, '63OMS3')]
        .map(toStr).filter(Boolean).join(' | ')

      const notes = [
        get(row, '95AT1'), get(row, '96AT2'), get(row, '97AT3'),
        get(row, '98AT4'), get(row, '99AT5')
      ].map(toStr).filter(Boolean).join('\n')

      const debiteurnummer = toStr(get(row, '40DEB'))
      const bixRaw = get(row, '82BIX')
      const baseIndexYear = bixRaw ? (parseInt(String(bixRaw)) || null) : null

      const data = {
        contractNumber: entityCode,
        customerName: debiteurnummer ?? entityCode,
        kostenplaats: toStr(get(row, '71KPL')),
        description: oms || null,
        startDate,
        endDate: parseDate(get(row, '23TOT')),
        contractValue,
        m2,
        pricePerM2,
        basePricePerM2: parseNum(get(row, '81BP')),
        baseIndexYear,
        indexSeries: toStr(get(row, '80RKS')),
        contractType: toStr(get(row, '10SRT')),
        invoiceFrequency: toStr(get(row, '20FREQ')),
        manager: toStr(get(row, '21MGR')),
        invoiceStartDate: parseDate(get(row, '24VANFC')),
        invoiceEndDate: parseDate(get(row, '25TOTFC')),
        debiteurnummer,
        kadastrale: toStr(get(row, '51KAD')),
        status: mapStatus(get(row, '11STAT')),
        notes: notes || null,
      }

      try {
        const existing = await prisma.contract.findUnique({ where: { contractNumber: entityCode } })
        if (existing) {
          await prisma.contract.update({ where: { contractNumber: entityCode }, data })
          updated++
        } else {
          await prisma.contract.create({ data })
          created++
        }
      } catch (e) {
        failed++
        failedCodes.push(entityCode)
        console.error('Import row error', entityCode, e.message)
      }
    }

    return NextResponse.json({ created, updated, failed, failedCodes: failedCodes.slice(0, 10) })
  } catch (err) {
    console.error('Import error', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
