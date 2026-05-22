'use client'

import { useState } from 'react'
import { Pencil, Save, X, Loader2, BookOpen } from 'lucide-react'

interface Props {
  initialVerse: string
  initialRef:   string
  isAutoMode?:  boolean
}

export function ScriptureEditor({ initialVerse, initialRef, isAutoMode = false }: Props) {
  const [editing, setEditing]   = useState(false)
  const [verse,   setVerse]     = useState(initialVerse)
  const [ref,     setRef]       = useState(initialRef)
  const [draftV,  setDraftV]    = useState(initialVerse)
  const [draftR,  setDraftR]    = useState(initialRef)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState<string | null>(null)
  const [saved,   setSaved]     = useState(false)

  async function save() {
    if (!draftV.trim() || !draftR.trim()) { setError('经文和出处不能为空'); return }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/church/scripture', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ verse: draftV.trim(), ref: draftR.trim() }),
      })
      if (!res.ok) throw new Error()
      setVerse(draftV.trim())
      setRef(draftR.trim())
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  function cancel() { setDraftV(verse); setDraftR(ref); setEditing(false); setError(null) }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-stone-50 px-4 py-3 border border-stone-100">
          <p className="text-sm text-stone-700 leading-relaxed italic">「{verse || '未设置'}」</p>
          {ref && <p className="text-xs text-stone-400 mt-1 text-right">— {ref}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAutoMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200
                             px-2.5 py-0.5 text-[11px] font-medium text-green-700">
              ✦ 自动每日更新
            </span>
          )}
          {!isAutoMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200
                             px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
              ✎ 今日已手动设置
            </span>
          )}
          <button
            onClick={() => { setDraftV(verse); setDraftR(ref); setEditing(true) }}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5
                       text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-violet-600 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            {isAutoMode ? '今日手动覆盖' : '重新编辑'}
          </button>
          {saved && <span className="text-xs text-green-600">✓ 已保存</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-stone-600 block mb-1.5">经文内容</label>
        <textarea
          autoFocus
          value={draftV}
          onChange={e => setDraftV(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="例：你们要将一切的忧虑卸给神，因为他顾念你们。"
          className="w-full rounded-xl border border-violet-200 bg-violet-50/30 px-4 py-2.5
                     text-sm text-stone-800 placeholder-stone-300 resize-none
                     focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-stone-600 block mb-1.5">经文出处</label>
        <input
          type="text"
          value={draftR}
          onChange={e => setDraftR(e.target.value)}
          maxLength={80}
          placeholder="例：彼得前书 5:7"
          className="w-full rounded-xl border border-violet-200 bg-violet-50/30 px-4 py-2.5
                     text-sm text-stone-800 placeholder-stone-300
                     focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5
                     text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          保存
        </button>
        <button
          onClick={cancel}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium
                     text-stone-500 hover:bg-stone-100 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
