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
  hideHint?:      boolean   // suppress the ambient hint text (e.g. when textarea has content)
  className?:     string
}

/**
 * 录音组件 — 物理红线执行点。
 *
 * 音销字留：chunks 拼合为 Blob 后立即传给父组件，本组件立即清空引用。
 * iOS 兼容：constraints 不含 sampleRate；mimeType 自动协商 mp4/webm/ogg。
 */
export function VoiceRecorder({
  onAudioReady,
  onError,
  onStateChange,
  disabled,
  hideHint,
  className,
}: VoiceRecorderProps) {
  const [state, setState]     = useState<VoiceState>('idle')
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopRef          = useRef<() => void>(() => {})

  const notify = useCallback((s: VoiceState) => {
    setState(s)
    onStateChange?.(s)
  }, [onStateChange])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
  }, [])

  useEffect(() => { stopRef.current = stopRecording }, [stopRecording])

  const startRecording = useCallback(async () => {
    try {
      // sampleRate omitted intentionally — causes OverconstrainedError on iOS Safari
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
      streamRef.current = stream

      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType   = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        chunksRef.current = []                              // ■ 音销
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        onAudioReady(blob)
        notify('processing')
      }

      recorder.start(250)
      notify('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1
          if (next >= MAX_RECORDING_SECONDS) { stopRef.current(); return prev }
          return next
        })
      }, 1000)

    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? '请在浏览器设置中允许麦克风权限后重试'
        : '无法启动录音，请检查设备'
      onError?.(msg)
      notify('idle')
    }
  }, [onAudioReady, onError, notify])

  const isRecording  = state === 'recording'
  const isProcessing = state === 'processing'

  // 5 wave bars — varied heights + staggered delays → convincing audio visualiser
  const BARS = [
    { h: 35,  d: '0ms'   },
    { h: 80,  d: '130ms' },
    { h: 100, d: '65ms'  },
    { h: 70,  d: '200ms' },
    { h: 45,  d: '30ms'  },
  ]

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>

      {/* Ambient hint — hidden when parent suppresses or during active states */}
      {!hideHint && !isRecording && !isProcessing && !disabled && (
        <p className="text-center text-xs text-muted-foreground/70 leading-snug max-w-[220px]">
          💡 不方便打字？点击麦克风说出来
        </p>
      )}

      {/* Ripple + Button */}
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <>
            <span aria-hidden className="absolute h-20 w-20 rounded-full bg-red-400/20 animate-ping"
              style={{ animationDuration: '1.6s' }} />
            <span aria-hidden className="absolute h-14 w-14 rounded-full bg-red-400/15 animate-ping"
              style={{ animationDuration: '2.2s', animationDelay: '0.5s' }} />
          </>
        )}

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isProcessing}
          aria-label={isRecording ? '点击结束录音' : '开始录音'}
          className={cn(
            'relative z-10 flex h-16 w-16 items-center justify-center rounded-full',
            'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isRecording  && 'bg-red-500 text-white shadow-lg shadow-red-400/40 animate-pulse',
            isProcessing && 'bg-oat-200 text-oat-500 cursor-not-allowed',
            !isRecording && !isProcessing && !disabled && 'bg-oat-300 text-oat-700 hover:bg-oat-400',
            !isRecording && !isProcessing && disabled  && 'bg-muted text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" />
           : isRecording ? <Square className="h-6 w-6 fill-current" />
           : <Mic className="h-7 w-7" />}
        </button>
      </div>

      {/* Wave visualiser — only while recording */}
      {isRecording && (
        <div aria-hidden className="flex items-end justify-center gap-[4px]" style={{ height: 28 }}>
          {BARS.map(({ h, d }, i) => (
            <div
              key={i}
              className="w-[5px] rounded-full bg-red-400 animate-bounce"
              style={{ height: `${h}%`, animationDelay: d, animationDuration: '620ms' }}
            />
          ))}
        </div>
      )}

      {/* Status label */}
      <p className={cn(
        'text-sm text-center leading-snug',
        isRecording  ? 'text-red-500 font-semibold' : 'text-muted-foreground',
        isProcessing && 'animate-pulse italic',
      )}>
        {isProcessing  && '正在对齐…'}
        {isRecording   && '说完了，点击完成'}
        {!isRecording && !isProcessing && !disabled && '点击麦克风，开始诉说'}
      </p>

      {isRecording && elapsed > 90 && (
        <p className="text-xs text-muted-foreground">剩余 {MAX_RECORDING_SECONDS - elapsed} 秒</p>
      )}
    </div>
  )
}
