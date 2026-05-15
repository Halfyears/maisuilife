import { Heart, AlertCircle } from 'lucide-react'

const STATUS_EMOJI: Record<string, string> = {
  感恩: '🌾', 平安: '☁️', 疲惫: '😔', 干渴: '🌵', 混乱: '🌀',
}

const STATUS_COLOR: Record<string, string> = {
  感恩: 'bg-gold-300',
  平安: 'bg-sage-300',
  疲惫: 'bg-muted-foreground/30',
  干渴: 'bg-amber-300',
  混乱: 'bg-destructive/30',
}

interface WeatherRow {
  status_tag: string
  count:      number
  pct:        number
}

interface PastoralCardProps {
  weather:      WeatherRow[]
  pendingCount: number
  todayCount:   number
}

const NUM = new Intl.NumberFormat('zh-CN')

export function PastoralCard({ weather, pendingCount, todayCount }: PastoralCardProps) {
  const sorted = [...weather].sort((a, b) => b.count - a.count)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
            <Heart className="h-4 w-4 text-rose-500" />
          </div>
          <h2 className="font-semibold text-foreground">牧养总览</h2>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {pendingCount} 待回应
          </div>
        )}
      </div>

      {/* Today's count summary */}
      <p className="text-sm text-muted-foreground">
        今日 <span className="font-semibold text-foreground">{NUM.format(todayCount)}</span> 位弟兄姐妹提交了当日内室
      </p>

      {/* Spiritual weather bars */}
      {sorted.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            全网属灵天气（今日）
          </p>
          {sorted.map(row => (
            <div key={row.status_tag} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span>{STATUS_EMOJI[row.status_tag] ?? '•'}</span>
                  <span className="text-foreground">{row.status_tag}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {NUM.format(row.count)} 人 · {row.pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${STATUS_COLOR[row.status_tag] ?? 'bg-muted-foreground/30'}`}
                  style={{ width: `${Math.max(row.pct, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-4">今日暂无对齐数据</p>
      )}

      {/* Pending pastoral notification */}
      {pendingCount === 0 ? (
        <div className="rounded-xl bg-sage-50 px-3 py-2 text-xs text-sage-700">
          暂无待回应的牧养请求
        </div>
      ) : (
        <div className="rounded-xl bg-destructive/8 px-3 py-2 text-xs text-destructive">
          有 {pendingCount} 份牧养请求等待组长回应
        </div>
      )}
    </div>
  )
}
