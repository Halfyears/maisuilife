'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InsightResponse } from '@/app/api/fellowship/insight/route'

interface InsightCardProps {
  fellowshipId: string
  initial: InsightResponse
}

export function InsightCard({ fellowshipId, initial }: InsightCardProps) {
  const [data, setData]       = useState(initial)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fellowship/insight?fellowship_id=${fellowshipId}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gold-200 bg-gold-400/6 px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold-700/70">
            AI 氛围预备
          </p>
          <h2 className="text-sm font-semibold text-foreground">本周团契建议</h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="刷新建议"
          className="rounded-lg p-1.5 text-muted-foreground hover:text-gold-700 hover:bg-gold-400/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Advice */}
      <p className="text-sm leading-relaxed text-foreground">{data.advice}</p>

      {/* Status distribution mini-chart */}
      {data.stats.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs text-muted-foreground">近 3 日状态分布</p>
          {data.stats.map(({ date, distribution }) => (
            <div key={date} className="flex items-start gap-2 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
                {date.slice(5)}
              </span>
              <span className="text-foreground/80">
                {Object.entries(distribution)
                  .map(([tag, n]) => `${tag} ${n}`)
                  .join('　')}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-right text-xs text-muted-foreground/50">
        {new Date(data.generated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 生成
      </p>
    </section>
  )
}
