'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_RECORDING_SECONDS } from '@/lib/constants'

export type VoiceState = 'idle' | 'recording' | 'processing'

interface VoiceRecorderProps {
  onAudioReady:   (blob: Blob) => void
  onError?:       (msg: string) => void
  onStateChange?: (state: VoiceState) => void
  disabled?:      boolean
  className?:     string
}

/**
 * 录音组件 — 物理红线执行点。
 *
 * 音销字留：
 *  1. chunks 拼合为 Blob 后立即传给父组件 onAudioReady，本组件立即清空引用。
 *  2. 组件卸载时释放 MediaStream 所有轨道。
 *
 * iOS 兼容性：
 *  - audio constraints 不含 sampleRate（触发 OverconstrainedError）
 *  - mimeType 顺序：webm/opus → webm → mp4 → ogg/opus → 浏览器默认
 */
export function VoiceRecorder({
  onAudioReady,
  onError,
  onStateChange,
  disabled,
  className,
}: VoiceRecorderProps) {
  const [state, setState]     = useState<VoiceState>('idle')
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopRef          = useRef<() => void>(() => {})

  const setStateAndNotify = useCallback((s: VoiceState) => {
    setState(s)
    onStateChange?.(s)
  }, [onStateChange])

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

  useEffect(() => { stopRef.current = stopRecording }, [stopRecording])

  const startRecording = useCallback(async () => {
    try {
      // sampleRate intentionally omitted — causes OverconstrainedError on iOS Safari
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
      streamRef.current = stream

      // Try mimeTypes in priority order; audio/mp4 is the iOS-compatible fallback
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType   = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        chunksRef.current = []                                   // ■ 音销
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
          if (next >= MAX_RECORDING_SECONDS) { stopRef.current(); return prev }
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

  // Wave bar config: [height%, animationDelay] — 5 bars, staggered bounce
  const WAVE_BARS = [
    { h: 40,  delay: '0ms'   },
    { h: 85,  delay: '140ms' },
    { h: 100, delay: '70ms'  },
    { h: 75,  delay: '210ms' },
    { h: 50,  delay: '35ms'  },
  ]

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>

      {/* ── Warm hint — visible when idle and enabled ──── */}
      {!isRecording && !isProcessing && !disabled && (
        <p className="text-center text-xs text-muted-foreground/80 leading-snug px-4 max-w-[240px]">
          💡 如果不方便打字，请点击麦克风对我说说您的心里话
        </p>
      )}

      {/* ── Ripple + Button ───────────────────────────── */}
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <span aria-hidden className="absolute h-20 w-20 rounded-full bg-red-400/20 animate-ping"
            style={{ animationDuration: '1.6s' }} />
        )}
        {isRecording && (
          <span aria-hidden className="absolute h-16 w-16 rounded-full bg-red-400/15 animate-ping"
            style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
        )}

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isProcessing}
          aria-label={isRecording ? '停止录音' : '开始录音'}
          className={cn(
            'relative z-10 flex h-16 w-16 items-center justify-center rounded-full',
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
            <Square className="h-6 w-6 fill-current" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </button>
      </div>

      {/* ── Sound wave visualizer — only during recording ─ */}
      {isRecording && (
        <div
          aria-hidden
          className="flex items-end justify-center gap-[3px]"
          style={{ height: 28 }}
        >
          {WAVE_BARS.map(({ h, delay }, i) => (
            <div
              key={i}
              className="w-[5px] rounded-full bg-red-400 animate-bounce"
              style={{
                height:            `${h}%`,
                animationDelay:    delay,
                animationDuration: '600ms',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Status label ─────────────────────────────── */}
      <p className={cn(
        'text-sm tracking-wide text-center',
        isRecording  ? 'text-red-500 font-semibold' : 'text-muted-foreground',
        isProcessing && 'italic animate-pulse',
      )}>
        {isProcessing  && '正在对齐…'}
        {isRecording   && '说完了，点击完成'}
        {!isRecording  && !isProcessing && !disabled && '点击麦克风，开始诉说'}
        {!isRecording  && !isProcessing && disabled  && '暂时无法使用语音'}
      </p>

      {isRecording && elapsed > 90 && (
        <p className="text-xs text-muted-foreground">
          剩余 {MAX_RECORDING_SECONDS - elapsed} 秒
        </p>
      )}
    </div>
  )
}
