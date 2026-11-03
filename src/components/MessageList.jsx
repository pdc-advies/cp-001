import { fmtDateTime } from '@/components/InvoiceStatus'

// Berichten van de koppeling, met het volledige verzoek en antwoord uitklapbaar
export default function MessageList({ messages, showInvoice = false }) {
  if (!messages.length) return <p className="text-sm text-gray-400">Nog geen berichten.</p>
  return (
    <ul className="divide-y divide-gray-100">
      {messages.map((m) => (
        <li key={m.id} className="py-2">
          <details>
            <summary className="cursor-pointer flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-xs text-gray-400 tabular-nums">{fmtDateTime(m.createdAt)}</span>
              <span className={`text-xs font-medium ${m.direction.startsWith('CP-001') ? 'text-blue-700' : 'text-slate-700'}`}>{m.direction}</span>
              <span className="text-gray-800">{m.operation}</span>
              <code className="text-xs text-gray-500">{m.method} {m.endpoint}</code>
              <span className={`text-xs font-medium ${m.httpStatus < 300 ? 'text-green-700' : 'text-red-700'}`}>{m.httpStatus}</span>
              {showInvoice && m.invoiceId && <a href={`/facturen/${m.invoiceId}`} className="text-xs text-blue-600 hover:underline">factuur CP001-{m.invoiceId}</a>}
            </summary>
            <div className="mt-2 grid lg:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Verzoek</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-96">{JSON.stringify(m.payload, null, 2)}</pre>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Antwoord</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-96">{JSON.stringify(m.response, null, 2)}</pre>
              </div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}
