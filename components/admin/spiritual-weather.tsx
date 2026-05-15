'use client'

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminStats } from '@/app/api/admin/stats/route'

interface SpiritualWeatherProps {
  initial: AdminStats['weather']
  todayCount: number
}

const TAG_COLORS: Record<string, string> = {
  '感恩': 'bg-gold-400',
  '平安': 'bg-sage-400',
  '疲惫': 'bg-stone-400',
  '干渴': 'bg-amber-500',
  '混乱': 'bg-blue-400',
}

export function SpiritualWeather({ initial, todayCount: initialCount }: SpiritualWeatherProps) {
  const [weather, setWeather]     = useState(initial)
  const [total, setTotal]         = useState(initialCount)
  const [loading, setLoading]     = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const stats: AdminStats = await res.json()
        setWeather(stats.weather)
        setTotal(stats.alignments_today)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            全网属灵天气
          </p>
          <p className="text-sm font-semibold text-foreground">
            今日 {total} 人已对齐
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

      {weather.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">今日暂无数据</p>
      ) : (
        <div className="space-y-3">
          {weather.map((item) => (
            <div key={item.status_tag}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground w-12">{item.status_tag}</span>
                <div className="flex-1 mx-3">
                  {/* CSS horizontal bar */}
                  <div className="h-6 w-full overflow-hidden rounded-md bg-muted relative">
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-md transition-all duration-700 flex items-center justify-end pr-2',
                        TAG_COLORS[item.status_tag] ?? 'bg-oat-400',
                      )}
                      style={{ width: `${item.pct}%` }}
                    >
                      {item.pct > 15 && (
                        <span className="text-[10px] font-bold text-white/90">
                          {item.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                  {item.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[10px] text-muted-foreground/50">
        仅聚合统计数字，不含任何个人内容
      </p>
    </section>
  )
}
