'use client'

import { useState, useTransition } from 'react'
import { BookOpen, Search, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemePlannerProps {
  fellowshipId: string
  initialTheme:        string | null
  initialScriptureRef: string | null
  initialScriptureText: string | null
  moodWords: string[]  // aggregated status_tags from members
}

export function ThemePlanner({
  fellowshipId,
  initialTheme,
  initialScriptureRef,
  initialScriptureText,
  moodWords,
}: ThemePlannerProps) {
  const [theme,         setTheme]         = useState(initialTheme ?? '')
  const [scriptureRef,  setScriptureRef]  = useState(initialScriptureRef ?? '')
  const [scriptureText, setScriptureText] = useState(initialScriptureText ?? '')
  const [isSearching,   setIsSearching]   = useState(false)
  const [searchError,   setSearchError]   = useState('')
  const [isSaving,      startSave]        = useTransition()
  const [saved,         setSaved]         = useState(false)

  async function searchScripture() {
    if (!scriptureRef.trim()) return
    setIsSearching(true)
    setSearchError('')
    try {
      const res = await fetch('/api/fellowship/scripture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ref: scriptureRef }),
      })
      const data = await res.json()
      if (data.text) setScriptureText(data.text)
      else setSearchError('未找到该经文，请检查格式，例如：约翰福音 3:16')
    } catch {
      setSearchError('网络异常，请稍后再试')
    } finally {
      setIsSearching(false)
    }
  }

  function handleSave() {
    setSaved(false)
    startSave(async () => {
      await fetch('/api/fellowship/session-plan', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fellowship_id: fellowshipId, theme, scripture_ref: scriptureRef, scripture_text: scriptureText }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
        <h2 className="text-sm font-bold text-foreground">本周备课</h2>
      </div>

      {/* Theme */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          聚会主题
        </label>
        <input
          value={theme}
          onChange={e => setTheme(e.target.value)}
          maxLength={80}
          placeholder="如：信心的根基、彼此相爱、新造的人……"
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3
                     text-sm text-stone-800 placeholder:text-stone-400
                     focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
        />
      </div>

      {/* Member mood words */}
      {moodWords.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            本周成员心境词 <span className="text-stone-400">（可参考选题）</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {moodWords.map(word => (
              <button
                key={word}
                type="button"
                onClick={() => setTheme(t => t ? `${t}、${word}` : word)}
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1
                           text-xs text-amber-700 hover:bg-amber-100 transition-colors"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scripture lookup */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          本周经文
        </label>
        <div className="flex gap-2">
          <input
            value={scriptureRef}
            onChange={e => setScriptureRef(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchScripture()}
            placeholder="如：约翰福音 3:16 或 腓立比书 4:6-7"
            className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-3
                       text-sm text-stone-800 placeholder:text-stone-400
                       focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={searchScripture}
            disabled={isSearching || !scriptureRef.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50
                       px-4 py-3 text-sm font-semibold text-amber-700
                       hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {isSearching
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />
            }
            查找
          </button>
        </div>
        {searchError && <p className="mt-1.5 text-xs text-red-500">{searchError}</p>}
      </div>

      {/* Scripture text display / editable */}
      {(scriptureText || scriptureRef) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
          {scriptureText ? (
            <>
              <p className="text-xs font-semibold text-amber-700 mb-1.5">{scriptureRef}</p>
              <textarea
                value={scriptureText}
                onChange={e => setScriptureText(e.target.value)}
                rows={4}
                className="w-full bg-transparent text-sm text-stone-700 leading-relaxed
                           resize-none focus:outline-none"
              />
            </>
          ) : (
            <p className="text-sm text-stone-400 italic">点击「查找」获取经文全文</p>
          )}
        </div>
      )}

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
          saved
            ? 'border border-green-200 bg-green-50 text-green-700'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:opacity-90 disabled:opacity-50',
        )}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved    && <CheckCircle2 className="h-4 w-4" />}
        {saved ? '已保存' : '保存备课'}
      </button>
    </div>
  )
}
