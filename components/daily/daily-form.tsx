'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, BookOpen } from 'lucide-react'
import { StatusSelector } from './status-selector'
import { cn } from '@/lib/utils'
import { SCRIPTURE_BANK } from '@/lib/constants'
import type { StatusTagValue } from '@/lib/constants'

interface DailyFormProps {
  fellowshipId?: string
}

interface AIResult {
  alignmentId: string
  comfort:     string
  verse:       string
  verse_ref:   string
}

function getFallbackVerse(mood: StatusTagValue): { verse: string; verse_ref: string } {
  const pool = SCRIPTURE_BANK.filter(s => s.mood === mood || s.mood === '通用')
  const pick  = pool[Math.floor(Math.random() * pool.length)]
  return { verse: pick.text, verse_ref: pick.ref }
}

export function DailyForm({ fellowshipId }: DailyFormProps) {
  const router = useRouter()

  const [statusTag,    setStatusTag]    = useState<StatusTagValue | null>(null)
  const [textInput,    setTextInput]    = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiResult,     setAiResult]     = useState<AIResult | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!statusTag || isSubmitting) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/align', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:    textInput.trim() || '（静默交托）',
          status_tag:    statusTag,
          is_urgent:     false,
          fellowship_id: fellowshipId ?? null,
        }),
      })
      if (res.ok) {
        const data: AIResult = await res.json()
        setAiResult(data)
      } else {
        throw new Error('api_error')
      }
    } catch {
      // 无条件通关：API 失败时展示本地经文，绝不拦截
      const { verse, verse_ref } = getFallbackVerse(statusTag)
      setAiResult({
        alignmentId: '',
        comfort:     '你的心声已悄悄落在祂面前，祂必看顾每一个细节。',
        verse,
        verse_ref,
      })
    } finally {
      setIsSubmitting(false)
    }

    setTimeout(() => router.push('/fellowship'), 4000)
  }, [statusTag, textInput, fellowshipId, router, isSubmitting])

  // ── 结果视图：展示 AI 安慰话与经文 ──────────────────────────────────
  if (aiResult) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="rounded-2xl border border-amber-100/80 bg-gradient-to-br
                        from-amber-50/80 to-orange-50/60 px-6 py-5
                        shadow-md shadow-amber-900/5">
          <p className="text-sm leading-relaxed text-stone-700">{aiResult.comfort}</p>
        </div>

        <div className="rounded-2xl border border-stone-100 bg-white/90 px-6 py-5
                        shadow-md shadow-amber-900/5 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm leading-relaxed text-stone-600 italic">
                "{aiResult.verse}"
              </p>
              <p className="mt-2 text-xs text-stone-400">—— {aiResult.verse_ref}</p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 animate-pulse">
          已记录，正在前往团契…
        </p>
      </div>
    )
  }

  // ── 主表单：一体象牙白卡片 ────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90
                    shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">

      {/* ── 今日心境选择区 ─────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-stone-50">
        <StatusSelector value={statusTag} onChange={setStatusTag} disabled={isSubmitting} />
      </div>

      {/* ── 文字输入区 ─────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-1">
        <textarea
          ref={textareaRef}
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="💡 聆听内室的微声，在这里卸下您的重担，写下您最真实的呼求..."
          rows={6}
          maxLength={800}
          disabled={isSubmitting}
          className="w-full bg-stone-50/90 rounded-xl p-4 border border-stone-200/60
                     focus:border-amber-400 focus:ring-1 focus:ring-amber-400
                     text-stone-700 placeholder:text-stone-400
                     min-h-[140px] resize-none focus:outline-none
                     disabled:opacity-60 text-sm leading-relaxed"
        />
        {/* 静态语音占位符 */}
        <p className="text-stone-300 text-xs mt-2 px-1 text-right select-none pointer-events-none">
          🎙️ 语音输入功能即将上线
        </p>
      </div>

      {/* ── 字数计数 ───────────────────────────────────────── */}
      <div className="flex justify-end px-5 pb-3">
        <span className="text-[11px] text-stone-300 tabular-nums">
          {textInput.length} / 800
        </span>
      </div>

      {/* ── 巨型推进按钮（焊死在卡片底部）─────────────────── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!statusTag || isSubmitting}
        className={cn(
          'w-full py-5 px-6 text-xl font-black tracking-widest text-center',
          'transition-all duration-300 active:scale-[0.99] focus:outline-none',
          statusTag && !isSubmitting
            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20'
            : 'bg-stone-50 text-stone-300 cursor-not-allowed',
        )}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2 text-base font-bold tracking-wide">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在聆听…
          </span>
        ) : statusTag ? (
          '📖 聆听圣经话语'
        ) : (
          '↑ 请先选择今日心境'
        )}
      </button>
    </div>
  )
}
