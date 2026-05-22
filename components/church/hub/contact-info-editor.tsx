'use client'

import { useState } from 'react'
import { Pencil, Save, X, Loader2, Phone } from 'lucide-react'

interface Props {
  churchId: string
  initialValue: string
}

export function ContactInfoEditor({ churchId, initialValue }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(initialValue)
  const [saving,  setSaving]  = useState(false)
  const [value,   setValue]   = useState(initialValue)
  const [error,   setError]   = useState<string | null>(null)

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/church/update-contact-info', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: churchId, contact_info: draft.trim() }),
      })
      if (!res.ok) throw new Error()
      setValue(draft.trim()); setEditing(false)
    } catch { setError('保存失败，请重试') }
    finally  { setSaving(false) }
  }

  function cancel() { setDraft(value); setEditing(false); setError(null) }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="例：微信号 pastor_zhang / 联系电话 138-xxxx-xxxx / 邮箱 church@example.com"
          className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm text-stone-700
                     focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
            <>
              <button onClick={save}
                className="flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5
                           text-xs font-bold text-white hover:bg-violet-600 transition-colors">
                <Save className="h-3 w-3" />保存
              </button>
              <button onClick={cancel}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500
                           hover:bg-stone-100 transition-colors">
                取消
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap flex-1">
        {value || <span className="text-stone-400 italic">尚未填写联系方式</span>}
      </p>
      <button onClick={() => setEditing(true)}
        className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                   text-xs text-stone-500 hover:border-violet-300 hover:text-violet-600
                   hover:bg-violet-50 transition-colors">
        <Pencil className="h-3 w-3" />{value ? '编辑' : '填写'}
      </button>
    </div>
  )
}

export function ContactInfoDisplay({ value }: { value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <Phone className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
      <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}
