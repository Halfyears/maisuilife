'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminStats } from '@/app/api/admin/stats/route'

interface CostPanelProps {
  initial: Pick<AdminStats,
    'billable_this_month' | 'cost_gemini_usd' | 'cost_whisper_usd' |
    'cost_total_usd' | 'generated_at'>
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
const NUM = new Intl.NumberFormat('en-US')

export function CostPanel({ initial }: CostPanelProps) {
  const [data, setData]       = useState(initial)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const stats: AdminStats = await res.json()
        setData({
          billable_this_month: stats.billable_this_month,
          cost_gemini_usd:     stats.cost_gemini_usd,
          cost_whisper_usd:    stats.cost_whisper_usd,
          cost_total_usd:      stats.cost_total_usd,
          generated_at:        stats.generated_at,
        })
        setLastUpdated(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  const rows = [
    { label: 'Gemini 1.5 Flash',      cost: data.cost_gemini_usd,  pct: data.cost_total_usd ? data.cost_gemini_usd  / data.cost_total_usd : 0, color: 'bg-gold-400' },
    { label: 'Groq Whisper STT',       cost: data.cost_whisper_usd, pct: data.cost_total_usd ? data.cost_whisper_usd / data.cost_total_usd : 0, color: 'bg-sage-400' },
  ]

  // Project to end-of-month
  const today     = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const elapsed   = today.getDate()
  const projected = elapsed > 0 ? (data.cost_total_usd / elapsed) * daysInMonth : 0

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            本月 AI 成本
          </p>
          <p className="text-xl font-bold text-foreground">
            {USD.format(data.cost_total_usd)}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Breakdown rows */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular-nums font-medium">{USD.format(row.cost)}</span>
            </div>
            {/* CSS progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all duration-700', row.color)}
                style={{ width: `${Math.round(row.pct * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">计费次数</p>
          <p className="text-sm font-semibold tabular-nums">
            {NUM.format(data.billable_this_month)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> 月末预估
          </p>
          <p className="text-sm font-semibold tabular-nums">{USD.format(projected)}</p>
        </div>
      </div>

      {/* Unit costs reference */}
      <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground/70 space-y-0.5">
        <p>Gemini: $0.0002 / 次 &nbsp;·&nbsp; Whisper: $0.0013 / 次</p>
        <p>更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
      </div>
    </section>
  )
}
