'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AUDIO_CONSTRAINTS, MAX_RECORDING_SECONDS } from '@/lib/constants'

type RecorderState = 'idle' | 'recording' | 'processing'

interface VoiceRecorderProps {
  onAudioReady: (blob: Blob) => void
  disabled?: boolean
  className?: string
}

/**
 * 录音组件 — 物理红线执行点。
 *
 * 音销字留：
 *  1. MediaRecorder chunks 拼合为 Blob 后立即传给父组件 onAudioReady。
 *  2. 本组件内 chunks 数组在 finally 块中被清空、长度归零。
 *  3. 原始音频 Blob 的生命周期由父组件（daily-form.tsx）负责：
 *     提交给 /api/stt 完成后立即令持有变量 = null。
 *  4. 组件卸载时释放 MediaStream 所有轨道（停止麦克风占用指示灯）。
 */
export function VoiceRecorder({ onAudioReady, disabled, className }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount: stop mic indicator
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      })
      streamRef.current = stream

      // Prefer opus (smallest for speech); fall back to browser default
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        // Build the final Blob from accumulated chunks
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })

        // ■ 音销 — clear chunk references immediately after assembly
        chunksRef.current.forEach((_, i) => {
          chunksRef.current[i] = new Blob() // drop reference to chunk data
        })
        chunksRef.current = []

        // Stop mic stream (releases OS microphone indicator)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        onAudioReady(audioBlob)
        setState('processing')
      }

      recorder.start(250) // collect chunks every 250ms
      setState('recording')
      setElapsed(0)

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)

    } catch (err) {
      console.error('[VoiceRecorder] getUserMedia error:', err)
      setState('idle')
    }
  }, [onAudioReady])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    mediaRecorderRef.current?.stop()
  }, [])

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const isRecording   = state === 'recording'
  const isProcessing  = state === 'processing'
  const isIdle        = state === 'idle'

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* ── Ripple + Button ───────────────────────────── */}
      <div className="relative flex items-center justify-center">

        {/* Outer ripple ring — subtle, single layer, only during recording */}
        {isRecording && (
          <span
            aria-hidden
            className="absolute h-20 w-20 rounded-full bg-gold-400/20 animate-ping"
            style={{ animationDuration: '1.8s' }}
          />
        )}

        {/* Inner ambient glow — softer pulse */}
        {isRecording && (
          <span
            aria-hidden
            className="absolute h-16 w-16 rounded-full bg-gold-400/15 animate-ping"
            style={{ animationDuration: '2.4s', animationDelay: '0.3s' }}
          />
        )}

        {/* Main button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isProcessing}
          aria-label={isRecording ? '停止录音' : '开始录音'}
          className={cn(
            'relative z-10 flex h-14 w-14 items-center justify-center rounded-full',
            'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring focus-visible:ring-offset-2',
            isRecording
              ? 'bg-gold-400 text-gold-900 shadow-lg shadow-gold-400/30 hover:bg-gold-500'
              : 'bg-oat-300 text-oat-700 hover:bg-oat-400',
            isProcessing && 'bg-oat-200 text-oat-500 cursor-not-allowed',
            disabled && !isProcessing && 'opacity-40 cursor-not-allowed',
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isRecording ? (
            <Square className="h-5 w-5 fill-current" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* ── Status label ─────────────────────────────── */}
      <p className={cn(
        'text-sm tabular-nums tracking-wide',
        isRecording   ? 'text-gold-600 font-medium' : 'text-muted-foreground',
        isProcessing  && 'text-muted-foreground italic',
      )}>
        {isProcessing  && '正在对齐…'}
        {isRecording   && `录音中  ${formatTime(elapsed)}`}
        {isIdle && !disabled && '点击麦克风，开始诉说'}
        {isIdle && disabled  && '请先选择今日心境'}
      </p>

      {/* ── Max duration hint ────────────────────────── */}
      {isRecording && elapsed > 90 && (
        <p className="text-xs text-muted-foreground">
          剩余 {MAX_RECORDING_SECONDS - elapsed} 秒
        </p>
      )}
    </div>
  )
}
