import { prisma } from '@/lib/prisma'

export const ENDPOINTS = {
  salesInvoice: '/api/unit4/sales-invoices',
  statusCallback: '/api/interface/unit4/invoice-status',
}

export const RICHTING = { naarUnit4: 'CP-001 → Unit4', naarCp001: 'Unit4 → CP-001' }

export const logMessage = (data) => prisma.interfaceMessage.create({ data })

export const externalId = (invoiceId) => `CP001-${invoiceId}`
export function invoiceIdFromExternal(id) {
  const match = /^CP001-(\d+)$/.exec(id ?? '')
  return match ? Number(match[1]) : null
}
