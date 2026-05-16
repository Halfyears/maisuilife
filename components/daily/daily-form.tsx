'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { StatusSelector } from './status-selector'
import { VoiceRecorder, type VoiceState } from './voice-recorder'
import { cn } from '@/lib/utils'
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

export function DailyForm({ fellowshipId }: DailyFormProps) {
  const router = useRouter()

  const [statusTag, setStatusTag]       = useState<StatusTagValue | null>(null)
  const [textInput, setTextInput]       = useState('')
  const [isUrgent, setIsUrgent]         = useState(false)
  const [voiceState, setVoiceState]     = useState<VoiceState>('idle')
  const [voiceFailed, setVoiceFailed]   = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [aiResult, setAiResult]         = useState<AIResult | null>(null)
  const [micWarn, setMicWarn]           = useState<string | null>(null)

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const audioBlobRef = useRef<Blob | null>(null)

  // ── Text submission → /api/align ───────────────────────
  const submitText = useCallback(async () => {
    if (!statusTag || isSubmitting) return
    setIsSubmitting(true); setSubmitError(null)
    try {
      const res = await fetch('/api/align', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:    textInput.trim() || '（静默交托）',
          status_tag:    statusTag,
          is_urgent:     isUrgent,
          fellowship_id: fellowshipId ?? null,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'network_error' }))
        throw new Error(error ?? 'unknown')
      }
      const data: AIResult = await res.json()
      setAiResult(data)
      setTimeout(() => router.push('/fellowship'), 3500)
    } catch (err) {
      const label = err instanceof Error ? err.message : 'unknown'
      setSubmitError(label === 'ai_circuit_breaker'
        ? 'AI 服务暂时停止，请稍后再试'
        : '网络异常，请检查连接后重试')
    } finally {
      setIsSubmitting(false)
    }
  }, [statusTag, textInput, isUrgent, fellowshipId, router, isSubmitting])

  // ── Voice submission → /api/stt ────────────────────────
  const handleAudioReady = useCallback(async (blob: Blob) => {
    if (!statusTag) return
    audioBlobRef.current = blob
    setIsSubmitting(true)

    const ext  = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    const form = new FormData()
    form.append('audio', blob, `audio.${ext}`)
    form.append('status_tag',   statusTag)
    form.append('is_urgent',    String(isUrgent))
    if (fellowshipId) form.append('fellowship_id', fellowshipId)

    try {
      const res = await fetch('/api/stt', { method: 'POST', body: form })
      audioBlobRef.current = null                          // ■ 音销
      if (!res.ok) throw new Error('stt_failed')
      const data: AIResult = await res.json()
      setAiResult(data)
      setTimeout(() => router.push('/fellowship'), 3500)
    } catch {
      // Silent degradation — no error shown, just switch to text mode
      audioBlobRef.current = null
      setVoiceFailed(true)
      setIsSubmitting(false)
      setTimeout(() => textareaRef.current?.focus(), 120)
    }
  }, [statusTag, isUrgent, fellowshipId, router])

  const handleVoiceError = useCallback((msg: string) => setMicWarn(msg), [])

  // ── AI result view ─────────────────────────────────────
  if (aiResult) {
    return (
      <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/60 px-5 py-5 shadow-sm">
          <p className="text-sm leading-relaxed text-stone-700">{aiResult.comfort}</p>
        </div>
        <div className="rounded-2xl border border-stone-100/85 bg-white/90 px-5 py-4 shadow-sm backdrop-blur-md">
          <p className="text-sm leading-relaxed text-stone-600 italic">{aiResult.verse}</p>
          <p className="mt-2 text-xs text-stone-400">—— {aiResult.verse_ref}</p>
        </div>
        <p className="text-center text-xs text-stone-400 animate-pulse">已记录，正在前往团契…</p>
      </div>
    )
  }

  const hasText       = textInput.trim().length > 0
  const voiceActive   = voiceState === 'recording' || voiceState === 'processing'
  const voiceDisabled = hasText || voiceFailed || isSubmitting || !statusTag

  return (
    <div className="flex flex-col gap-5">

      {/* ── 1. Status selector ─────────────────────────── */}
      <div className="rounded-2xl border border-stone-100/85 bg-white/90 p-5 shadow-sm backdrop-blur-md
                      transition-all duration-300">
        <StatusSelector value={statusTag} onChange={setStatusTag} disabled={isSubmitting} />
      </div>

      {/* ── 2. Textarea fused with submit button ────────── */}
      <div className="rounded-2xl border border-stone-100/85 bg-white/90 shadow-sm backdrop-blur-md
                      overflow-hidden transition-all duration-300">

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="💡 聆听内室的微声，在这里写下你想说的话..."
          rows={6}
          maxLength={800}
          disabled={isSubmitting}
          className="w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed
                     text-stone-800 placeholder:text-stone-300
                     focus:outline-none disabled:opacity-60"
        />

        {/* Character count + divider */}
        <div className="flex items-center justify-between border-t border-stone-100 px-5 py-2">
          <span className="text-[11px] text-stone-300 tabular-nums">{textInput.length} / 800</span>
        </div>

        {/* ── Submit button — fused to bottom of card ── */}
        <button
          type="button"
          onClick={submitText}
          disabled={!statusTag || isSubmitting || voiceActive}
          className={cn(
            'w-full px-5 py-4 text-sm font-bold tracking-wide transition-all duration-300',
            'active:scale-[0.99] focus:outline-none',
            statusTag && !isSubmitting
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/10'
              : 'bg-stone-50 text-stone-300 cursor-not-allowed',
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在对齐…
            </span>
          ) : !statusTag ? (
            '↑ 请先选择今日心境'
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              状态已锁定，点击进入下一阶段：聆听圣经话语
            </span>
          )}
        </button>
      </div>

      {/* ── 3. Submit error ────────────────────────────── */}
      {submitError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-600">{submitError}</p>
          <button type="button" onClick={() => setSubmitError(null)}
            className="mt-1 text-xs text-red-400 underline underline-offset-2">
            知道了
          </button>
        </div>
      )}

      {/* ── 4. Urgent prayer flag ──────────────────────── */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-100/85
                        bg-white/90 px-5 py-4 shadow-sm backdrop-blur-md transition-all duration-300
                        has-[:checked]:border-amber-200 has-[:checked]:bg-amber-50/60">
        <input
          type="checkbox"
          checked={isUrgent}
          onChange={e => setIsUrgent(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-amber-500"
        />
        <span className="text-sm text-stone-500 leading-snug">
          标记代祷需求 — 组长收到匿名信号，待你授权后方可了解是你
        </span>
      </label>

      {/* ── 5. Voice input — passive, below the main flow ─ */}
      <div className={cn(
        'flex flex-col items-center gap-4 rounded-2xl border border-dashed py-6 px-5',
        'bg-white/60 backdrop-blur-sm transition-all duration-300',
        voiceFailed  ? 'border-stone-200 opacity-50' : 'border-stone-200',
        !statusTag   ? 'opacity-40' : '',
      )}>
        <VoiceRecorder
          onAudioReady={handleAudioReady}
          onError={handleVoiceError}
          onStateChange={setVoiceState}
          disabled={voiceDisabled}
          hideHint={hasText || voiceFailed || !statusTag}
        />
        {micWarn && !voiceFailed && (
          <p className="text-xs font-medium text-amber-600 text-center max-w-[240px]">{micWarn}</p>
        )}
        {/* No error shown on voice failure — completely silent degradation */}
      </div>

    </div>
  )
}
