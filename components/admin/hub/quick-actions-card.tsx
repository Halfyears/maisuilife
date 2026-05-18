'use client'

import { useState, useCallback } from 'react'
import { Zap, CloudLightning, ShieldCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsCardProps {
  aiActive: boolean
}

export function QuickActionsCard({ aiActive: initialActive }: QuickActionsCardProps) {
  const [active,    setActive]    = useState(initialActive)
  const [cbLoading, setCbLoading] = useState(false)
  const [cbConfirm, setCbConfirm] = useState(false)

  const toggleCircuit = useCallback(async () => {
    const next = !active
    if (!next && !cbConfirm) {
      setCbConfirm(true)
      setTimeout(() => setCbConfirm(false), 4000)
      return
    }
    setCbLoading(true); setCbConfirm(false)
    try {
      const res = await fetch('/api/admin/circuit-breaker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      })
      if (res.ok) setActive(next)
    } finally { setCbLoading(false) }
  }, [active, cbConfirm])

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 col-span-full">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
          <Zap className="h-4 w-4 text-purple-500" />
        </div>
        <h2 className="font-semibold text-foreground">全局 AI 熔断器</h2>
      </div>

      <div className={cn(
        'rounded-xl border p-4 space-y-3 transition-colors',
        active ? 'border-border bg-muted/20' : 'border-destructive/30 bg-destructive/5',
      )}>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            active ? 'bg-sage-100 text-sage-600' : 'bg-destructive/15 text-destructive',
          )}>
            {active ? <ShieldCheck className="h-4 w-4" /> : <CloudLightning className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              AI 服务 — {active ? '正常运行中' : '已熔断'}
            </p>
            <p className={cn('text-xs', active ? 'text-sage-600' : 'text-destructive')}>
              {active
                ? '关闭后，全网所有录音提交将立即返回 503，需二次确认'
                : 'AI 已熔断，所有 STT 请求被拒绝；开启后恢复处理'}
            </p>
          </div>
        </div>
        {cbLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />处理中…
          </div>
        ) : active ? (
          <button type="button" onClick={toggleCircuit}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
              cbConfirm
                ? 'border-destructive bg-destructive text-white animate-pulse'
                : 'border-destructive/40 text-destructive hover:bg-destructive hover:text-white',
            )}>
            {cbConfirm ? '⚠ 再次点击确认熔断' : '立即熔断'}
          </button>
        ) : (
          <button type="button" onClick={toggleCircuit}
            className="rounded-lg border border-sage-300 bg-sage-100 px-4 py-2 text-sm font-medium text-sage-700 hover:bg-sage-200 transition-colors">
            恢复 AI
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        💡 新建团契请前往
        <a href="/church/hub" className="ml-1 text-violet-500 hover:underline">教会管理中枢</a>
        操作。
      </p>
    </div>
  )
}
