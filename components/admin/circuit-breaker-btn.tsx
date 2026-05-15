'use client'

import { useState, useCallback } from 'react'
import { CloudLightning, ShieldCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CircuitBreakerBtnProps {
  initialActive: boolean
}

export function CircuitBreakerBtn({ initialActive }: CircuitBreakerBtnProps) {
  const [active, setActive]   = useState(initialActive)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)    // two-click safety for disable

  const toggle = useCallback(async () => {
    const next = !active

    // Require confirm-click before disabling AI
    if (!next && !confirm) {
      setConfirm(true)
      setTimeout(() => setConfirm(false), 4000)   // auto-cancel after 4s
      return
    }

    setLoading(true)
    setConfirm(false)
    try {
      const res = await fetch('/api/admin/circuit-breaker', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: next }),
      })
      if (res.ok) setActive(next)
    } finally {
      setLoading(false)
    }
  }, [active, confirm])

  return (
    <section id="circuit-breaker" className="scroll-mt-6">
      <div className={cn(
        'rounded-2xl border p-5 transition-colors',
        active
          ? 'border-border bg-card'
          : 'border-destructive/30 bg-destructive/5',
      )}>
        <div className="flex items-start justify-between gap-4">
          {/* Status info */}
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              active ? 'bg-sage-100 text-sage-600' : 'bg-destructive/15 text-destructive',
            )}>
              {active
                ? <ShieldCheck   className="h-5 w-5" />
                : <CloudLightning className="h-5 w-5" />
              }
            </div>
            <div>
              <p className="font-semibold text-foreground">Global AI Circuit Breaker</p>
              <p className={cn(
                'text-sm mt-0.5',
                active ? 'text-sage-600' : 'text-destructive',
              )}>
                {active ? 'AI 服务正常运行中' : 'AI 服务已熔断 — 所有 STT 请求被拒绝'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {active
                  ? '点击"立即熔断"可一键停止全网所有 AI 处理。需二次确认。'
                  : '点击"恢复 AI"可立即重启服务，已排队请求需重新提交。'
                }
              </p>
            </div>
          </div>

          {/* Action button */}
          <div className="shrink-0">
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">处理中…</span>
              </div>
            ) : active ? (
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  'rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                  confirm
                    ? 'border-destructive bg-destructive text-white animate-pulse'
                    : 'border-destructive/40 text-destructive hover:bg-destructive hover:text-white',
                )}
              >
                {confirm ? '⚠ 再次点击确认熔断' : '立即熔断'}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggle}
                className="rounded-xl border border-sage-300 bg-sage-100 px-4 py-2.5 text-sm font-medium text-sage-700 hover:bg-sage-200 transition-colors"
              >
                恢复 AI
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
