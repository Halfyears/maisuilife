'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { StatusSelector } from './status-selector'
import { VoiceRecorder, type VoiceState } from './voice-recorder'
import { STATUS_TAGS } from '@/lib/constants'
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

type FormStep = 'mood' | 'input' | 'submitting' | 'done' | 'error'

export function DailyForm({ fellowshipId }: DailyFormProps) {
  const router = useRouter()

  const [step, setStep]             = useState<FormStep>('mood')
  const [statusTag, setStatusTag]   = useState<StatusTagValue | null>(null)
  const [isUrgent, setIsUrgent]     = useState(false)
  const [textInput, setTextInput]   = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [aiResult, setAiResult]     = useState<AIResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const audioBlobRef = useRef<Blob | null>(null)

  // Auto-focus textarea when entering input step
  useEffect(() => {
    if (step === 'input') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [step])

  // ── Step 1: mood confirmed ──────────────────────────────
  const confirmMood = useCallback(() => {
    if (statusTag) setStep('input')
  }, [statusTag])

  // ── Step back from input → mood ─────────────────────────
  const goBackToMood = useCallback(() => {
    setStep('mood')
    setTextInput('')
    setIsUrgent(false)
  }, [])

  // ── Text submission path → /api/align ───────────────────
  const submitText = useCallback(async () => {
    if (!statusTag || !textInput.trim()) return

    setStep('submitting')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/align', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:    textInput.trim(),
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
      setStep('done')
      setTimeout(() => router.push('/fellowship'), 2000)

    } catch (err) {
      const label = err instanceof Error ? err.message : 'unknown'
      setErrorMsg(
        label === 'ai_circuit_breaker'
          ? 'AI 服务暂时停止，请稍后再试'
          : label === 'pipeline_error'
          ? '对齐遇到问题，请稍后再试'
          : '网络异常，请检查连接后重试'
      )
      setStep('error')
    }
  }, [statusTag, textInput, isUrgent, fellowshipId, router])

  // ── Voice submission path → /api/stt ────────────────────
  const handleAudioReady = useCallback(async (blob: Blob) => {
    if (!statusTag) return

    audioBlobRef.current = blob
    setStep('submitting')
    setErrorMsg(null)

    const form = new FormData()
    form.append('audio',        blob, 'voice.webm')
    form.append('status_tag',   statusTag)
    form.append('is_urgent',    String(isUrgent))
    if (fellowshipId) form.append('fellowship_id', fellowshipId)

    try {
      const res = await fetch('/api/stt', { method: 'POST', body: form })

      // ■ 音销
      audioBlobRef.current = null

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'network_error' }))
        throw new Error(error ?? 'unknown')
      }

      const data: AIResult = await res.json()
      setAiResult(data)
      setStep('done')
      setTimeout(() => router.push('/fellowship'), 2000)

    } catch (err) {
      audioBlobRef.current = null
      const label = err instanceof Error ? err.message : 'unknown'
      setErrorMsg(
        label === 'ai_circuit_breaker'
          ? 'AI 服务暂时停止，请稍后再试'
          : label === 'pipeline_error'
          ? '对齐遇到问题，请稍后再试'
          : '网络异常，请检查连接后重试'
      )
      setStep('error')
    }
  }, [statusTag, isUrgent, fellowshipId, router])

  const handleVoiceError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setStep('error')
  }, [])

  const handleRetry = useCallback(() => {
    setStep(statusTag ? 'input' : 'mood')
    setErrorMsg(null)
  }, [statusTag])

  // ── Done ───────────────────────────────────────────────
  if (step === 'done' && aiResult) {
    return <AlignmentResult result={aiResult} />
  }

  // ── Step 1: Mood selection ──────────────────────────────
  if (step === 'mood') {
    return (
      <div className="flex flex-col gap-6">
        <StatusSelector
          value={statusTag}
          onChange={setStatusTag}
          disabled={false}
        />
        <button
          type="button"
          onClick={confirmMood}
          disabled={!statusTag}
          className="w-full rounded-2xl bg-gold-400 py-3.5 text-sm font-semibold text-gold-900
                     hover:bg-gold-500 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          确定，进入下一步
        </button>
      </div>
    )
  }

  // ── Step 2: Input (text + voice) ────────────────────────
  const moodMeta = STATUS_TAGS.find((t) => t.value === statusTag)
  const isSubmitting = step === 'submitting'
  const canSubmitText = textInput.trim().length > 0 && voiceState === 'idle' && !isSubmitting

  return (
    <div className="flex flex-col gap-5">

      {/* Mood badge — tap to go back */}
      <button
        type="button"
        onClick={goBackToMood}
        disabled={isSubmitting}
        className="flex w-fit items-center gap-1.5 rounded-full border border-border
                   bg-card px-3 py-1.5 text-sm text-muted-foreground
                   hover:bg-muted transition-colors disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        <span>{moodMeta?.emoji} {moodMeta?.label}</span>
      </button>

      {/* Text area */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="在这里写下今日的心声…"
          rows={5}
          maxLength={800}
          disabled={isSubmitting}
          className="w-full resize-none rounded-2xl border border-border bg-card
                     px-4 py-3 text-sm leading-relaxed text-foreground
                     placeholder:text-muted-foreground/60
                     focus:outline-none focus:ring-2 focus:ring-ring
                     disabled:opacity-50"
        />
        <p className="self-end text-[11px] text-muted-foreground tabular-nums">
          {textInput.length} / 800
        </p>
      </div>

      {/* Urgent prayer flag */}
      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border
                        bg-card px-4 py-3 has-[:checked]:border-gold-300 has-[:checked]:bg-gold-400/5
                        transition-colors">
        <input
          type="checkbox"
          checked={isUrgent}
          onChange={(e) => setIsUrgent(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 h-4 w-4 rounded border-border accent-gold-400"
        />
        <span className="text-sm text-muted-foreground leading-snug">
          标记代祷需求 — 组长会看到匿名信号，向你发出关怀邀请后再由你决定是否授权
        </span>
      </label>

      {/* Error state */}
      {step === 'error' && errorMsg && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p>{errorMsg}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 text-xs underline underline-offset-2 hover:text-destructive/80"
          >
            重新尝试
          </button>
        </div>
      )}

      {/* Text submit button — only shown when textarea has content and voice is idle */}
      {canSubmitText && (
        <button
          type="button"
          onClick={submitText}
          className="w-full rounded-2xl bg-gold-400 py-3 text-sm font-semibold text-gold-900
                     hover:bg-gold-500 transition-colors"
        >
          用文字对齐
        </button>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">或用声音</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Voice recorder */}
      <div className="flex flex-col items-center gap-2 py-2">
        <VoiceRecorder
          onAudioReady={handleAudioReady}
          onError={handleVoiceError}
          onStateChange={setVoiceState}
          disabled={isSubmitting || canSubmitText}
        />
        {isSubmitting && (
          <p className="text-sm text-muted-foreground animate-pulse text-center">
            正在对齐…
          </p>
        )}
      </div>

    </div>
  )
}

// ── Post-alignment result card ────────────────────────────
function AlignmentResult({ result }: { result: AIResult }) {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="rounded-2xl border border-gold-200 bg-gold-400/8 px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground">{result.comfort}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground/80 italic">{result.verse}</p>
        <p className="mt-2 text-xs text-muted-foreground">—— {result.verse_ref}</p>
      </div>
      <p className="text-center text-xs text-muted-foreground">已记录，正在前往团契…</p>
    </div>
  )
}
