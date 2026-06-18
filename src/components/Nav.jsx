'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const path = usePathname()
  const link = (href, label) => (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        path === href || (href !== '/' && path.startsWith(href))
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  )
  return (
    <nav className="flex items-center gap-1 ml-6">
      {link('/', 'Contracten')}
      {link('/customers', 'Klanten')}
    </nav>
  )
}
