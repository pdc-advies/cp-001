import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const contracts = await prisma.contract.findMany({
    orderBy: { id: 'asc' }
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Contracten')

  sheet.columns = [
    { header: 'Contract Nr', key: 'contractNumber', width: 20 },
    { header: 'Klant', key: 'customerName', width: 28 },
    { header: 'Kostenplaats', key: 'kostenplaats', width: 20 },
    { header: 'Omschrijving', key: 'description', width: 45 },
    { header: 'Startdatum', key: 'startDate', width: 15 },
    { header: 'Einddatum', key: 'endDate', width: 15 },
    { header: 'm²', key: 'm2', width: 12 },
    { header: 'Prijs/m²', key: 'pricePerM2', width: 15 },
    { header: 'Basisprijs', key: 'basePrice', width: 15 },
    { header: 'Index', key: 'priceIndex', width: 12 },
    { header: 'Geïndexeerde prijs', key: 'indexedPrice', width: 20 },
    { header: 'Waarde', key: 'contractValue', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Notities', key: 'notes', width: 35 }
  ]

  sheet.getRow(1).font = { bold: true }

  for (const c of contracts) {
    const basePrice = (c.m2 != null && c.pricePerM2 != null) ? c.m2 * c.pricePerM2 : null
    const indexedPrice = (basePrice != null && c.priceIndex != null) ? basePrice * c.priceIndex : null
    sheet.addRow({
      contractNumber: c.contractNumber,
      customerName: c.customerName,
      kostenplaats: c.kostenplaats ?? '',
      description: c.description ?? '',
      startDate: c.startDate ? new Date(c.startDate).toLocaleDateString('nl-NL') : '',
      endDate: c.endDate ? new Date(c.endDate).toLocaleDateString('nl-NL') : '',
      m2: c.m2,
      pricePerM2: c.pricePerM2,
      basePrice,
      priceIndex: c.priceIndex,
      indexedPrice,
      contractValue: c.contractValue,
      status: c.status,
      notes: c.notes ?? ''
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="contracten.xlsx"'
    }
  })
}
