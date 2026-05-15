import { createServiceClient } from '@/lib/supabase/server'
import { CostPanel }          from '@/components/admin/cost-panel'
import { SpiritualWeather }   from '@/components/admin/spiritual-weather'
import { ConfigEditor }       from '@/components/admin/config-editor'
import { CircuitBreakerBtn }  from '@/components/admin/circuit-breaker-btn'
import type { AdminStats }    from '@/app/api/admin/stats/route'
import type { SystemConfig }  from '@/app/api/admin/config/route'

export const metadata  = { title: '管理中枢 — 麦穗喜乐' }
export const revalidate = 60   // ISR: rebuild every 60s

const NUM = new Intl.NumberFormat('en-US')

export default async function AdminHubPage() {
  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  // ── Parallel server-side data fetch ───────────────────
  const [
    usersRes, todayRes, monthlyRes,
    weatherRes, configsRes, circuitRes,
  ] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('daily_alignments').select('id', { count: 'exact', head: true }).eq('date', today),
    db.from('daily_alignments').select('id', { count: 'exact', head: true }).gte('date', monthStart).eq('is_silent', false),
    db.from('admin_spiritual_weather').select('status_tag, count, pct'),
    db.from('system_configs').select('id, key, value, updated_at').order('key'),
    db.from('system_configs').select('value').eq('key', 'ai_circuit_breaker').single(),
  ])

  const billable    = monthlyRes.count ?? 0
  const geminiCost  = billable * 0.0002
  const whisperCost = billable * 0.0013
  const totalCost   = geminiCost + whisperCost

  const costInitial: Pick<AdminStats,
    'billable_this_month' | 'cost_gemini_usd' | 'cost_whisper_usd' |
    'cost_total_usd' | 'generated_at'> = {
    billable_this_month: billable,
    cost_gemini_usd:     geminiCost,
    cost_whisper_usd:    whisperCost,
    cost_total_usd:      totalCost,
    generated_at:        new Date().toISOString(),
  }

  const configs     = (configsRes.data ?? []) as SystemConfig[]
  const aiActive    = circuitRes.data?.value?.active ?? true
  const weatherData = (weatherRes.data ?? []) as AdminStats['weather']

  return (
    <div className="flex flex-col">
      {/* ── Stats Bar ─────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-6 px-6 py-3">
          <h1 className="text-base font-semibold text-foreground shrink-0">
            管理中枢
          </h1>
          <div className="flex flex-1 items-center gap-6 overflow-x-auto">
            <StatChip label="注册用户" value={NUM.format(usersRes.count ?? 0)} />
            <StatChip label="今日对齐" value={NUM.format(todayRes.count ?? 0)} />
            <StatChip label="本月计费" value={NUM.format(billable) + ' 次'} />
            <StatChip
              label="AI 状态"
              value={aiActive ? '正常' : '已熔断'}
              valueClass={aiActive ? 'text-sage-600' : 'text-destructive'}
            />
            <StatChip
              label="本月费用"
              value={`$${totalCost.toFixed(4)}`}
              valueClass="tabular-nums"
            />
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="flex-1 p-6 space-y-6">

        {/* Row 1: Cost + Weather (side by side on wide screens) */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <CostPanel initial={costInitial} />
          <SpiritualWeather initial={weatherData} todayCount={todayRes.count ?? 0} />
        </div>

        {/* Row 2: Config DataTable */}
        <ConfigEditor configs={configs} />

        {/* Row 3: Circuit Breaker */}
        <CircuitBreakerBtn initialActive={aiActive} />
      </main>
    </div>
  )
}

// ── Stats bar chip ────────────────────────────────────────
function StatChip({
  label, value, valueClass,
}: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col shrink-0">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </span>
      <span className={`text-sm font-semibold text-foreground mt-0.5 leading-none ${valueClass ?? ''}`}>
        {value}
      </span>
    </div>
  )
}
