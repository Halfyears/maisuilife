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
  alignmentId:       string
  comfort:           string
  verse:             string
  verse_ref:         string
  contributed_wheat: boolean
}

function getFallbackVerse(tags: StatusTagValue[]): { verse: string; verse_ref: string } {
  const pool = tags.length > 0
    ? SCRIPTURE_BANK.filter(s => tags.some(t => (s.mood as string) === t) || s.mood === '通用')
    : SCRIPTURE_BANK.filter(s => s.mood === '通用')
  const effective = pool.length > 0 ? pool : [...SCRIPTURE_BANK]
  const pick = effective[Math.floor(Math.random() * effective.length)]
  return { verse: pick.text, verse_ref: pick.ref }
}

export function DailyForm({ fellowshipId }: DailyFormProps) {
  const router = useRouter()
  const [selectedTags, setSelectedTags] = useState<StatusTagValue[]>([])
  const [textInput,    setTextInput]    = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiResult,     setAiResult]     = useState<AIResult | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const toggleTag = useCallback((tag: StatusTagValue) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  // ── 零硬性拦截：只要有标签或有文字，即可提交 ──────────────
  const canSubmit = !isSubmitting && (selectedTags.length > 0 || textInput.trim().length > 0)

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/align', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:    textInput.trim() || '（静默交托）',
          status_tag:    selectedTags.join('、'),
          is_urgent:     false,
          fellowship_id: fellowshipId ?? null,
          // Pass client's actual local clock so the server uses the correct date
          client_date:   new Intl.DateTimeFormat('en-CA').format(new Date()),
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
      const { verse, verse_ref } = getFallbackVerse(selectedTags)
      setAiResult({
        alignmentId: '',
        comfort:     '你今日的呼求，神没有一字遗漏，祂都听见了。无论你带来的是重担、疲惫还是沉默，这一切祂都知道。愿这段经文在你心中慢慢生根，成为今日的力量与安慰。',
        verse,
        verse_ref,
      })
    } finally {
      setIsSubmitting(false)
    }
    // ── 无自动跳转：原地停留，让用户充分默想消化 ──────────────
  }, [canSubmit, textInput, selectedTags, fellowshipId])

  // ── AI 结果视图（留在内室页，不跳转）────────────────────────
  if (aiResult) {
    return (
      <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-500">

        {/* 属灵回应 */}
        <div className="rounded-2xl border border-amber-100/80 bg-gradient-to-br
                        from-amber-50/80 to-orange-50/60 px-6 py-6
                        shadow-md shadow-amber-900/5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-3">
            属灵回应
          </p>
          <p className="text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
            {aiResult.comfort}
          </p>
        </div>

        {/* 今日经文 */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 px-6 py-5
                        shadow-md shadow-amber-900/5 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
                今日经文
              </p>
              <p className="text-base leading-relaxed text-stone-700 italic font-medium">
                "{aiResult.verse}"
              </p>
              <p className="mt-3 text-xs text-stone-400">—— {aiResult.verse_ref}</p>
            </div>
          </div>
        </div>

        {/* 麦穗贡献通知 */}
        {aiResult.contributed_wheat && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80
                          bg-gradient-to-r from-amber-50 to-yellow-50/60
                          px-5 py-4 shadow-sm
                          animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
            <span className="text-2xl" style={{ animation: 'bounce 1s ease 2' }}>🌾</span>
            <p className="text-sm font-medium text-amber-700">
              你已默默为团契粮仓贡献了 1 颗麦穗
            </p>
          </div>
        )}

        {/* 静默提示 */}
        <p className="text-center text-xs text-stone-300 pb-4 leading-relaxed">
          愿你在此默想，让圣言在心中慢慢生根。
        </p>
      </div>
    )
  }

  // ── 主表单：一体象牙白卡片 ────────────────────────────────────
  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90
                    shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">

      {/* ── 今日心境（多选）─────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-stone-50">
        <StatusSelector
          values={selectedTags}
          onToggle={toggleTag}
          disabled={isSubmitting}
        />
      </div>

      {/* ── 文字输入区 ─────────────────────────────── */}
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
                     min-h-[260px] resize-none focus:outline-none
                     disabled:opacity-60 text-sm leading-relaxed"
        />
        {/* 静态语音占位符 */}
        <p className="text-stone-300 text-xs mt-2 px-1 text-right select-none pointer-events-none">
          🎙️ 语音输入功能即将上线
        </p>
      </div>

      {/* ── 字数计数 ─────────────────────────────────── */}
      <div className="flex justify-end px-5 pb-3">
        <span className="text-[11px] text-stone-300 tabular-nums">
          {textInput.length} / 800
        </span>
      </div>

      {/* ── 巨型推进按钮 ─────────────────────────────── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'w-full block py-6 px-6 text-2xl font-black tracking-widest text-center',
          'transition-all duration-300 active:scale-[0.99] focus:outline-none',
          canSubmit
            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20 cursor-pointer rounded-b-2xl'
            : 'bg-stone-50 text-stone-300 cursor-not-allowed rounded-b-2xl',
        )}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2 text-base font-bold tracking-wide">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在聆听…
          </span>
        ) : canSubmit ? (
          '📖 聆听圣经话语'
        ) : (
          '请在上方倾诉或选择心境'
        )}
      </button>
    </div>
  )
}
