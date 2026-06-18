const { PrismaClient } = require('@prisma/client')
const ExcelJS = require('exceljs')
const path = require('path')

const prisma = new PrismaClient()

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node prisma/seed.js <path-to-excel>')
    process.exit(1)
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.resolve(filePath))
  const sheet = wb.getWorksheet(1)

  // Read header row to map columns by name
  const headers = {}
  sheet.getRow(1).eachCell((cell, col) => {
    headers[String(cell.value).trim().toLowerCase()] = col
  })

  const col = (row, name) => {
    const c = headers[name.toLowerCase()]
    return c ? row.getCell(c).value : null
  }

  let created = 0, skipped = 0

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const contractNumber = String(col(row, 'contract nr') ?? '').trim()
    if (!contractNumber) continue

    const existing = await prisma.contract.findUnique({ where: { contractNumber } })
    if (existing) { skipped++; continue }

    const startRaw = col(row, 'start date')
    const endRaw = col(row, 'end date')
    const valueRaw = col(row, 'value')

    await prisma.contract.create({
      data: {
        contractNumber,
        customerName: String(col(row, 'customer') ?? '').trim(),
        kostenplaats: String(col(row, 'kostenplaats') ?? '').trim() || null,
        description: String(col(row, 'description') ?? '').trim() || null,
        startDate: startRaw ? new Date(startRaw) : new Date(),
        endDate: endRaw ? new Date(endRaw) : null,
        contractValue: valueRaw !== null ? parseFloat(valueRaw) : null,
        status: String(col(row, 'status') ?? 'draft').trim(),
        notes: String(col(row, 'notes') ?? '').trim() || null,
      }
    })
    created++
    console.log(`  + ${contractNumber}`)
  }

  console.log(`Done: ${created} created, ${skipped} skipped (already exist)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
