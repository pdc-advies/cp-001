'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquarePlus, CheckCircle2, RotateCcw } from 'lucide-react'
import { TEAMS } from '@/lib/teams'

const fmtDateTime = (s) =>
  new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function TeamBadge({ team, done = false }) {
  const config = TEAMS[team]
  if (!config) return null
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${done ? 'bg-gray-50 text-gray-400 ring-gray-200' : config.badge}`}>
      {config.label}
    </span>
  )
}

// Notities bij een contract, nieuwste eerst, met datum/tijd en auteur. Een notitie met een team is een actie
// die afgerond kan worden. `legacy` is het oude notitieveld (uit de import). `onChange` na toevoegen/afronden.
export default function ContractNotes({ contractId, legacy, compact = false, onChange }) {
  const [notes, setNotes] = useState(null)
  const [text, setText] = useState('')
  const [team, setTeam] = useState('')
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

  const send = async (url, method, body) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error || 'Fout bij opslaan')
      await load()
      onChange?.()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = async () => {
    if (!text.trim()) return
    if (await send(`/api/contracts/${contractId}/notes`, 'POST', { text, team: team || null })) {
      setText('')
      setTeam('')
    }
  }

  const setDone = (note, done) => send(`/api/contracts/${contractId}/notes/${note.id}`, 'PATCH', { done })

  const size = compact ? 'text-xs' : 'text-sm'
  const control = `${size} border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500`

  return (
    <div className={`space-y-2 ${size}`}>
      <textarea
        rows={compact ? 2 : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nieuwe notitie of actie, bijv. ‘Grens van dit perceel controleren’…"
        className={`w-full px-3 py-2 resize-none ${control}`}
      />
      <div className="flex items-center gap-2">
        <select value={team} onChange={(e) => setTeam(e.target.value)} className={`px-2 py-1.5 text-gray-700 ${control}`} title="Toewijzen aan een team maakt er een actie van">
          <option value="">Geen actie (alleen notitie)</option>
          {Object.entries(TEAMS).map(([key, t]) => (
            <option key={key} value={key}>Actie voor {t.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={saving || !text.trim()}
          className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 ${size} font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
          Toevoegen
        </button>
      </div>
      {error && <p className="px-2 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700">{error}</p>}
      {notes === null && !error && <p className="text-gray-400">Notities laden…</p>}
      {notes?.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => {
            const done = Boolean(n.doneAt)
            return (
              <li key={n.id} className={`border-l-2 pl-2 ${n.team && !done ? 'border-amber-400' : 'border-blue-200'}`}>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500">
                  <span className="font-medium text-gray-700">{n.author}</span>
                  <span>· {fmtDateTime(n.createdAt)}</span>
                  {n.team && <TeamBadge team={n.team} done={done} />}
                  {n.team && (
                    <button
                      type="button"
                      onClick={() => setDone(n, !done)}
                      disabled={saving}
                      className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md disabled:opacity-50 ${done ? 'text-gray-500 hover:bg-gray-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                    >
                      {done ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {done ? 'Heropenen' : 'Afgerond'}
                    </button>
                  )}
                </div>
                <p className={`whitespace-pre-wrap ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{n.text}</p>
                {done && (
                  <p className="text-[11px] text-green-700">Afgerond door {n.doneBy} · {fmtDateTime(n.doneAt)}</p>
                )}
              </li>
            )
          })}
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
