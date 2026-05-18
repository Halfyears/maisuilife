'use client'

import { useState } from 'react'
import { Pencil, Save, X, Loader2 } from 'lucide-react'

export function ChurchNameEditor({ initialName }: { initialName: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(initialName)
  const [draft, setDraft]     = useState(initialName)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function save() {
    if (!draft.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: 'church_name', value: { name: draft.trim() } }),
      })
      if (!res.ok) throw new Error()
      setName(draft.trim())
      setEditing(false)
    } catch {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  function cancel() { setDraft(name); setEditing(false); setError(null) }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="flex-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-bold
                       text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-300 max-w-[240px]"
          />
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
          ) : (
            <>
              <button onClick={save} className="flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1.5
                text-xs font-medium text-white hover:bg-violet-600 transition-colors">
                <Save className="h-3 w-3" />保存
              </button>
              <button onClick={cancel} className="rounded-lg border border-stone-200 p-1.5 text-stone-400
                hover:bg-stone-100 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </>
      ) : (
        <>
          <span className="text-base font-bold text-stone-900 truncate">
            {name || '未设置教会名称'}
          </span>
          <button
            onClick={() => { setDraft(name); setEditing(true) }}
            className="shrink-0 rounded-lg border border-stone-200 p-1.5 text-stone-400
                       hover:bg-stone-100 hover:text-violet-600 transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
