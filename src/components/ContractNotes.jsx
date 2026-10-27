'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquarePlus } from 'lucide-react'

const fmtDateTime = (s) =>
  new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Notities bij een contract, nieuwste eerst, met datum/tijd en auteur. `legacy` is het oude notitieveld (uit de import).
export default function ContractNotes({ contractId, legacy, compact = false }) {
  const [notes, setNotes] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractId}/notes`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    setNotes(json)
  }, [contractId])

  useEffect(() => {
    setNotes(null)
    load().catch((err) => setError(err.message))
  }, [load])

  const add = async () => {
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/contracts/${contractId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Fout bij opslaan')
      setText('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const size = compact ? 'text-xs' : 'text-sm'

  return (
    <div className={`space-y-2 ${size}`}>
      <div className="flex gap-2">
        <textarea
          rows={compact ? 2 : 3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nieuwe notitie…"
          className={`flex-1 px-3 py-2 ${size} border border-gray-300 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        <button
          type="button"
          onClick={add}
          disabled={saving || !text.trim()}
          className={`self-end inline-flex items-center gap-1.5 px-2.5 py-1.5 ${size} font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
          Toevoegen
        </button>
      </div>
      {error && <p className="px-2 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700">{error}</p>}
      {notes === null && !error && <p className="text-gray-400">Notities laden…</p>}
      {notes?.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-blue-200 pl-2">
              <p className="text-gray-500 text-[11px]">
                <span className="font-medium text-gray-700">{n.author}</span> · {fmtDateTime(n.createdAt)}
              </p>
              <p className="text-gray-800 whitespace-pre-wrap">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
      {legacy && (
        <div className="border-l-2 border-gray-200 pl-2">
          <p className="text-gray-500 text-[11px]">Eerdere notitie (zonder datum)</p>
          <p className="text-gray-800 whitespace-pre-wrap">{legacy}</p>
        </div>
      )}
      {notes?.length === 0 && !legacy && <p className="text-gray-400">Nog geen notities.</p>}
    </div>
  )
}
