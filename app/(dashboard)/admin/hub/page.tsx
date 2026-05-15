import { createServiceClient } from '@/lib/supabase/server'
import { DevopsCard }      from '@/components/admin/hub/devops-card'
import { FinanceCard }     from '@/components/admin/hub/finance-card'
import { PastoralCard }    from '@/components/admin/hub/pastoral-card'
import { QuickActionsCard } from '@/components/admin/hub/quick-actions-card'
import { Wheat }           from 'lucide-react'

export const metadata  = { title: '管理中枢 — 麦穗喜乐' }
export const revalidate = 60

const GEMINI_RATE  = 0.0002   // USD per billable alignment
const WHISPER_RATE = 0.0013

export default async function AdminHubPage() {
  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  // ── Parallel server-side fetch ──────────────────────────────────────
  const [
    usersRes,
    todayRes,
    monthlyRes,
    fellowshipsRes,
    weatherRes,
    pendingRes,
    configsRes,
    circuitRes,
  ] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),

    db.from('daily_alignments')
      .select('id', { count: 'exact', head: true })
      .eq('date', today),

    db.from('daily_alignments')
      .select('id', { count: 'exact', head: true })
      .gte('date', monthStart)
      .eq('is_silent', false),

    db.from('fellowships')
      .select('id', { count: 'exact', head: true }),

    db.from('admin_spiritual_weather')
      .select('status_tag, count, pct'),

    // PENDING pastoral requests — count only, no personal data
    db.from('pastoral_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING'),

    db.from('system_configs')
      .select('id, key, value, updated_at')
      .order('key'),

    db.from('system_configs')
      .select('value')
      .eq('key', 'ai_circuit_breaker')
      .single(),
  ])

  const billable    = monthlyRes.count ?? 0
  const geminiCost  = billable * GEMINI_RATE
  const whisperCost = billable * WHISPER_RATE
  const totalCost   = geminiCost + whisperCost
  const aiActive    = circuitRes.data?.value?.active ?? true

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <Wheat className="h-5 w-5 text-gold-500 shrink-0" />
          <h1 className="text-base font-semibold text-foreground shrink-0">管理中枢</h1>
          <span className="hidden sm:inline text-xs text-muted-foreground">|</span>
          <span className="hidden sm:inline text-xs text-muted-foreground truncate">麦穗喜乐后台</span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className={[
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              aiActive
                ? 'bg-sage-100 text-sage-700'
                : 'bg-destructive/10 text-destructive',
            ].join(' ')}>
              <span className={[
                'inline-block h-1.5 w-1.5 rounded-full',
                aiActive ? 'bg-sage-500 animate-pulse' : 'bg-destructive',
              ].join(' ')} />
              AI {aiActive ? '正常' : '已熔断'}
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main content grid ────────────────────────────────────────── */}
      <main className="p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-2 xl:grid-cols-3">

          <DevopsCard
            usersTotal={usersRes.count ?? 0}
            alignmentsToday={todayRes.count ?? 0}
            fellowshipsTotal={fellowshipsRes.count ?? 0}
            billable={billable}
            geminiCost={geminiCost}
            whisperCost={whisperCost}
            totalCost={totalCost}
            monthStart={monthStart}
          />

          <FinanceCard configs={(configsRes.data ?? []) as {
            id: string; key: string; value: Record<string, unknown>; updated_at: string
          }[]} />

          <PastoralCard
            weather={(weatherRes.data ?? []) as { status_tag: string; count: number; pct: number }[]}
            pendingCount={pendingRes.count ?? 0}
            todayCount={todayRes.count ?? 0}
          />

          {/* Quick Actions spans the full row */}
          <QuickActionsCard aiActive={aiActive} />

        </div>
      </main>
    </div>
  )
}
