'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
      <Printer className="w-4 h-4" />
      Afdrukken of PDF
    </button>
  )
}
