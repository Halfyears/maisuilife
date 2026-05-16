'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_RECORDING_SECONDS } from '@/lib/constants'

export type VoiceState = 'idle' | 'recording' | 'processing'

interface VoiceRecorderProps {
  onAudioReady:  (blob: Blob) => void
  onError?:      (msg: string) => void
  onStateChange?: (state: VoiceState) => void
  disabled?:     boolean
  className?:    string
}

/**
 * 录音组件 — 物理红线执行点。
 *
 * 音销字留：
 *  1. MediaRecorder chunks 拼合为 Blob 后立即传给父组件 onAudioReady。
 *  2. 本组件内 chunks 数组在 onstop 回调中被清空。
 *  3. 原始音频 Blob 的生命周期由父组件（daily-form.tsx）负责。
 *  4. 组件卸载时释放 MediaStream 所有轨道。
 *
 * iOS 兼容性：
 *  - audio constraints 不含 sampleRate（会触发 OverconstrainedError）
 *  - mimeType 顺序：webm/opus → webm → mp4 → ogg/opus → 浏览器默认
 */
export function VoiceRecorder({
  onAudioReady,
  onError,
  onStateChange,
  disabled,
  className,
}: VoiceRecorderProps) {
  const [state, setState]   = useState<VoiceState>('idle')
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  // Keep a ref to the stop function so the timer callback can call it without a closure
  const stopRef          = useRef<() => void>(() => {})

  const setStateAndNotify = useCallback((s: VoiceState) => {
    setState(s)
    onStateChange?.(s)
  }, [onStateChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    mediaRecorderRef.current?.stop()
  }, [])

  // Keep stopRef current so the timer can call it
  useEffect(() => { stopRef.current = stopRecording }, [stopRecording])

  const startRecording = useCallback(async () => {
    try {
      // sampleRate intentionally omitted — causes OverconstrainedError on iOS Safari
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream

      // Try mimeTypes in order; audio/mp4 is the iOS-compatible fallback
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })

        // ■ 音销 — clear chunk references
        chunksRef.current = []

        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        onAudioReady(audioBlob)
        setStateAndNotify('processing')
      }

      recorder.start(250)
      setStateAndNotify('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1
          if (next >= MAX_RECORDING_SECONDS) {
            stopRef.current()
            return prev
          }
          return next
        })
      }, 1000)

    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? '请允许麦克风权限后重试'
        : '无法启动录音，请检查设备'
      onError?.(msg)
      setStateAndNotify('idle')
    }
  }, [onAudioReady, onError, setStateAndNotify])

  const isRecording  = state === 'recording'
  const isProcessing = state === 'processing'

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* ── Ripple + Button ───────────────────────────── */}
      <div className="relative flex items-center justify-center">

        {isRecording && (
          <span
            aria-hidden
            className="absolute h-20 w-20 rounded-full bg-red-400/20 animate-ping"
            style={{ animationDuration: '1.6s' }}
          />
        )}
        {isRecording && (
          <span
            aria-hidden
            className="absolute h-16 w-16 rounded-full bg-red-400/15 animate-ping"
            style={{ animationDuration: '2.2s', animationDelay: '0.4s' }}
          />
        )}

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
              ? 'bg-red-500 text-white shadow-lg shadow-red-400/40 animate-pulse'
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
        'text-sm tracking-wide text-center',
        isRecording  ? 'text-red-500 font-medium' : 'text-muted-foreground',
        isProcessing && 'text-muted-foreground italic animate-pulse',
      )}>
        {isProcessing && '正在对齐…'}
        {isRecording  && '说完了，点击完成'}
        {!isRecording && !isProcessing && !disabled && '点击麦克风，开始诉说'}
        {!isRecording && !isProcessing && disabled  && '请先选择今日心境'}
      </p>

      {/* Max duration warning */}
      {isRecording && elapsed > 90 && (
        <p className="text-xs text-muted-foreground">
          剩余 {MAX_RECORDING_SECONDS - elapsed} 秒
        </p>
      )}
    </div>
  )
}
