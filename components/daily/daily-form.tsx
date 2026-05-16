'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { StatusSelector } from './status-selector'
import { VoiceRecorder, type VoiceState } from './voice-recorder'
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

  const [statusTag, setStatusTag]     = useState<StatusTagValue | null>(null)
  const [textInput, setTextInput]     = useState('')
  const [isUrgent, setIsUrgent]       = useState(false)
  const [voiceState, setVoiceState]   = useState<VoiceState>('idle')
  // voiceFailed: STT pipeline error → silently disable voice, no message shown
  const [voiceFailed, setVoiceFailed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [aiResult, setAiResult]         = useState<AIResult | null>(null)

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const audioBlobRef = useRef<Blob | null>(null)

  // ── Text path → /api/align ─────────────────────────────
  const submitText = useCallback(async () => {
    if (!statusTag) return
    setIsSubmitting(true)
    setSubmitError(null)
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
      setTimeout(() => router.push('/fellowship'), 3000)
    } catch (err) {
      const label = err instanceof Error ? err.message : 'unknown'
      setSubmitError(
        label === 'ai_circuit_breaker'
          ? 'AI 服务暂时停止，请稍后再试'
          : '网络异常，请检查连接后重试'
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [statusTag, textInput, isUrgent, fellowshipId, router])

  // ── Voice path → /api/stt ──────────────────────────────
  const handleAudioReady = useCallback(async (blob: Blob) => {
    if (!statusTag) return
    audioBlobRef.current = blob
    setIsSubmitting(true)

    // Derive filename extension from actual MIME — Groq uses it to identify codec
    const ext  = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    const form = new FormData()
    form.append('audio',        blob, `audio.${ext}`)
    form.append('status_tag',   statusTag)
    form.append('is_urgent',    String(isUrgent))
    if (fellowshipId) form.append('fellowship_id', fellowshipId)

    try {
      const res = await fetch('/api/stt', { method: 'POST', body: form })
      audioBlobRef.current = null                          // ■ 音销

      if (!res.ok) throw new Error('stt_failed')

      const data: AIResult = await res.json()
      setAiResult(data)
      setTimeout(() => router.push('/fellowship'), 3000)
    } catch {
      // Silent degradation: no error message, just switch to text mode
      audioBlobRef.current = null
      setVoiceFailed(true)
      setIsSubmitting(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [statusTag, isUrgent, fellowshipId, router])

  // Mic permission errors: shown inline near recorder (not a blocking error)
  const [micWarn, setMicWarn] = useState<string | null>(null)
  const handleVoiceError = useCallback((msg: string) => setMicWarn(msg), [])

  // ── Result view ────────────────────────────────────────
  if (aiResult) {
    return (
      <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500 py-4">
        <div className="rounded-2xl border border-gold-200 bg-gold-400/8 px-5 py-5">
          <p className="text-sm leading-relaxed text-foreground">{aiResult.comfort}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm leading-relaxed text-foreground/80 italic">{aiResult.verse}</p>
          <p className="mt-2 text-xs text-muted-foreground">—— {aiResult.verse_ref}</p>
        </div>
        <p className="text-center text-xs text-muted-foreground animate-pulse">
          已记录，正在前往团契…
        </p>
      </div>
    )
  }

  const hasText       = textInput.trim().length > 0
  const voiceActive   = voiceState === 'recording' || voiceState === 'processing'
  // Voice disabled when: textarea has content, STT failed, or a submission is in flight
  const voiceDisabled = hasText || voiceFailed || isSubmitting
  // Submit button: always rendered, active only when a status is chosen
  const canSubmit     = statusTag !== null && !isSubmitting && !voiceActive

  return (
    <div className="flex flex-col gap-6">

      {/* ── 1. Status selector ─────────────────────────── */}
      <StatusSelector
        value={statusTag}
        onChange={setStatusTag}
        disabled={isSubmitting}
      />

      {/* ── 2. Text input — always editable ────────────── */}
      <div className="flex flex-col gap-1.5">
        <textarea
          ref={textareaRef}
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="💡 聆听内室的微声，在这里写下你想说的话..."
          rows={6}
          maxLength={800}
          disabled={isSubmitting}
          className="w-full resize-none rounded-2xl border border-border bg-card
                     px-4 py-3.5 text-sm leading-relaxed text-foreground
                     placeholder:text-muted-foreground/50
                     focus:outline-none focus:ring-2 focus:ring-ring
                     disabled:opacity-60 transition-colors"
        />
        <p className="self-end text-[11px] text-muted-foreground/60 tabular-nums">
          {textInput.length} / 800
        </p>
      </div>

      {/* ── 3. Urgent prayer flag ──────────────────────── */}
      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border
                        bg-card px-4 py-3
                        has-[:checked]:border-gold-300 has-[:checked]:bg-gold-400/5
                        transition-colors">
        <input
          type="checkbox"
          checked={isUrgent}
          onChange={e => setIsUrgent(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-gold-400"
        />
        <span className="text-sm text-muted-foreground leading-snug">
          标记代祷需求 — 组长收到匿名信号后，由你决定是否授权关怀
        </span>
      </label>

      {/* ── 4. Voice input section ────────────────────── */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-5">
        <p className="text-xs text-muted-foreground">—— 或用声音录入 ——</p>
        <VoiceRecorder
          onAudioReady={handleAudioReady}
          onError={handleVoiceError}
          onStateChange={setVoiceState}
          disabled={voiceDisabled}
          hideHint={hasText || voiceFailed}
        />
        {/* Mic permission warning — recoverable, shown only when relevant */}
        {micWarn && !voiceFailed && (
          <p className="text-xs text-amber-600 text-center px-6">{micWarn}</p>
        )}
        {isSubmitting && voiceActive && (
          <p className="text-sm text-muted-foreground animate-pulse">正在对齐…</p>
        )}
      </div>

      {/* ── 5. Submit error ───────────────────────────── */}
      {submitError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{submitError}</p>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="mt-1.5 text-xs text-destructive/70 underline underline-offset-2"
          >
            知道了，重新尝试
          </button>
        </div>
      )}

      {/* ── 6. Submit button — always visible ─────────── */}
      <button
        type="button"
        onClick={submitText}
        disabled={!canSubmit}
        className="w-full rounded-2xl py-4 text-sm font-semibold transition-all duration-200
                   disabled:cursor-not-allowed
                   enabled:bg-amber-500 enabled:text-white enabled:hover:bg-amber-600 enabled:shadow-md enabled:shadow-amber-500/25
                   disabled:bg-muted disabled:text-muted-foreground"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在对齐…
          </span>
        ) : !statusTag ? (
          '请先选择今日心境 ↑'
        ) : (
          '选好了，进入下一阶段：聆听圣经话语'
        )}
      </button>

    </div>
  )
}
