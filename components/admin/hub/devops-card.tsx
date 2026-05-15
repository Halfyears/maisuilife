import { Server, Users, Layers, TrendingUp } from 'lucide-react'

interface DevopsCardProps {
  usersTotal:       number
  alignmentsToday:  number
  fellowshipsTotal: number
  billable:         number
  geminiCost:       number
  whisperCost:      number
  totalCost:        number
  monthStart:       string   // "YYYY-MM-01"
}

const NUM = new Intl.NumberFormat('zh-CN')
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })

export function DevopsCard({
  usersTotal, alignmentsToday, fellowshipsTotal,
  billable, geminiCost, whisperCost, totalCost, monthStart,
}: DevopsCardProps) {
  // Month-end cost projection
  const today   = new Date()
  const elapsed = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const projected = elapsed > 0 ? (totalCost / elapsed) * daysInMonth : 0

  const geminiPct  = totalCost > 0 ? (geminiCost  / totalCost) * 100 : 50
  const whisperPct = totalCost > 0 ? (whisperCost / totalCost) * 100 : 50

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-100">
          <Server className="h-4 w-4 text-sage-600" />
        </div>
        <h2 className="font-semibold text-foreground">运维监控</h2>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="注册用户" value={NUM.format(usersTotal)} />
        <Stat icon={<TrendingUp className="h-3.5 w-3.5" />} label="今日对齐" value={NUM.format(alignmentsToday)} />
        <Stat icon={<Layers className="h-3.5 w-3.5" />} label="团契数" value={NUM.format(fellowshipsTotal)} />
      </div>

      {/* Cost breakdown */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            本月费用 ({monthStart.slice(5, 7)} 月)
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {USD.format(totalCost)}
          </span>
        </div>

        {/* Gemini bar */}
        <CostBar label="Gemini 1.5 Flash" cost={geminiCost} pct={geminiPct} color="bg-gold-300" />
        {/* Whisper bar */}
        <CostBar label="Groq Whisper" cost={whisperCost} pct={whisperPct} color="bg-sage-300" />

        <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>本月计费 {NUM.format(billable)} 次</span>
          <span>预测月底 {USD.format(projected)}</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/40 px-3 py-2.5">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-base font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function CostBar({ label, cost, pct, color }: { label: string; cost: number; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">{USD.format(cost)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
