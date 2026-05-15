'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StatusSelector } from './status-selector'
import { VoiceRecorder } from './voice-recorder'
import type { StatusTagValue } from '@/lib/constants'

interface DailyFormProps {
  fellowshipId?: string   // passed from server — needed to create urgent_flag
}

interface AIResult {
  alignmentId: string
  comfort: string
  verse: string
  verse_ref: string
}

type FormState = 'selecting' | 'recording' | 'submitting' | 'done' | 'error'

export function DailyForm({ fellowshipId }: DailyFormProps) {
  const router = useRouter()

  const [statusTag, setStatusTag]   = useState<StatusTagValue | null>(null)
  const [isUrgent, setIsUrgent]     = useState(false)
  const [formState, setFormState]   = useState<FormState>('selecting')
  const [aiResult, setAiResult]     = useState<AIResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  // Holds the audio Blob between onAudioReady and form submission.
  // nulled immediately after the fetch completes (音销字留).
  const audioBlobRef = useRef<Blob | null>(null)

  const handleStatusChange = useCallback((tag: StatusTagValue) => {
    setStatusTag(tag)
    if (formState === 'selecting') setFormState('recording')
  }, [formState])

  const handleAudioReady = useCallback(async (blob: Blob) => {
    if (!statusTag) return

    audioBlobRef.current = blob
    setFormState('submitting')
    setErrorMsg(null)

    const form = new FormData()
    form.append('audio', blob, 'voice.webm')
    form.append('status_tag', statusTag)
    form.append('is_urgent', String(isUrgent))
    if (fellowshipId) form.append('fellowship_id', fellowshipId)

    try {
      const res = await fetch('/api/stt', { method: 'POST', body: form })

      // ■ 音销 — drop blob reference regardless of fetch result
      audioBlobRef.current = null

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'network_error' }))
        throw new Error(error ?? 'unknown')
      }

      const data: AIResult = await res.json()
      setAiResult(data)
      setFormState('done')

      // Auto-navigate to fellowship after showing result (2s grace)
      setTimeout(() => router.push('/fellowship'), 2000)

    } catch (err) {
      audioBlobRef.current = null  // ensure cleared on error path too
      const label = err instanceof Error ? err.message : 'unknown'
      setErrorMsg(label === 'pipeline_error'
        ? '对齐遇到问题，请稍后再试'
        : '网络异常，请检查连接后重试'
      )
      setFormState('error')
    }
  }, [statusTag, router])

  const handleRetry = useCallback(() => {
    setFormState(statusTag ? 'recording' : 'selecting')
    setErrorMsg(null)
  }, [statusTag])

  // ── Render ───────────────────────────────────────────────

  if (formState === 'done' && aiResult) {
    return <AlignmentResult result={aiResult} />
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Status selector — always visible */}
      <StatusSelector
        value={statusTag}
        onChange={handleStatusChange}
        disabled={formState === 'submitting' || formState === 'done'}
      />

      {/* Urgent prayer flag */}
      {statusTag && formState === 'recording' && (
        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-card px-4 py-3">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-gold-400"
          />
          <span className="text-sm text-muted-foreground leading-snug">
            标记代祷需求 — 组长会看到匿名信号，向你发出关怀邀请后再由你决定是否授权
          </span>
        </label>
      )}

      {/* Recorder — shown once a status is chosen */}
      {statusTag && (
        <div className="flex flex-col items-center gap-2 py-4">
          <VoiceRecorder
            onAudioReady={handleAudioReady}
            disabled={formState === 'submitting'}
          />
          {formState === 'submitting' && (
            <p className="text-sm text-muted-foreground animate-pulse text-center">
              正在对齐…
            </p>
          )}
        </div>
      )}

      {/* Error state */}
      {formState === 'error' && errorMsg && (
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
    </div>
  )
}

// ── Post-alignment result card ────────────────────────────
function AlignmentResult({ result }: { result: AIResult }) {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Comfort */}
      <div className="rounded-2xl border border-gold-200 bg-gold-400/8 px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground">{result.comfort}</p>
      </div>

      {/* Verse */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground/80 italic">
          {result.verse}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">—— {result.verse_ref}</p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        已记录，正在前往团契…
      </p>
    </div>
  )
}
