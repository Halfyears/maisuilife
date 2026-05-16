import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Sprout, Users, BarChart2, Settings } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DailyForm } from '@/components/daily/daily-form'
import { PastoralNotification } from '@/components/shared/pastoral-notification'

export const metadata = { title: '今日内室 — 麦穗喜乐' }
export const revalidate = 0

// ── Bottom navigation tabs ────────────────────────────────
const NAV_TABS = [
  { href: '/daily',       Icon: Sprout,   label: '内室记录', active: true  },
  { href: '/fellowship',  Icon: Users,    label: '团契小组', active: false },
  { href: '#growth',      Icon: BarChart2, label: '灵命成长', active: false },
  { href: '/settings',   Icon: Settings, label: '设置中心', active: false },
] as const

export default async function DailyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const db    = createServiceClient()

  const [alignmentRes, membershipRes, pastoralRes] = await Promise.all([
    supabase
      .from('daily_alignments')
      .select('id, status_tag')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),

    db
      .from('fellowship_members')
      .select('fellowship_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),

    db
      .from('pastoral_requests')
      .select('id, leader_id')
      .eq('member_id', user.id)
      .eq('status', 'PENDING')
      .limit(1)
      .maybeSingle(),
  ])

  const existing     = alignmentRes.data
  const fellowshipId = membershipRes.data?.fellowship_id ?? undefined

  let leaderName: string | undefined
  if (pastoralRes.data) {
    const { data: leader } = await db
      .from('users')
      .select('display_name')
      .eq('id', pastoralRes.data.leader_id)
      .single()
    leaderName = leader?.display_name
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">

      {/* ── Sticky header ──────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/fellowship"
            className="flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground
                       hover:bg-muted hover:text-foreground transition-colors"
            aria-label="退出内室，返回团契"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">退出</span>
          </Link>

          <div className="flex-1 text-center">
            <h1 className="text-sm font-semibold text-foreground">今日内室</h1>
            <p className="text-[11px] text-muted-foreground">{formatChineseDate(new Date())}</p>
          </div>

          {/* Spacer to balance the back button width */}
          <div className="w-14" aria-hidden />
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 pb-32 pt-6">

          {/* Pastoral care notification */}
          {pastoralRes.data && (
            <div className="mb-6">
              <PastoralNotification
                requestId={pastoralRes.data.id}
                leaderName={leaderName}
              />
            </div>
          )}

          {existing ? (
            <AlreadySubmitted statusTag={existing.status_tag} />
          ) : (
            <DailyForm fellowshipId={fellowshipId} />
          )}
        </div>
      </main>

      {/* ── Fixed bottom navigation ────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-stretch">
          {NAV_TABS.map(({ href, Icon, label, active }) => (
            <Link
              key={href}
              href={href}
              className={[
                'flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                active
                  ? 'text-amber-600'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Icon
                className={['h-5 w-5', active ? 'text-amber-500' : ''].join(' ')}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {label}
              {active && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-500" aria-hidden />
              )}
            </Link>
          ))}
        </div>
      </nav>

    </div>
  )
}

function AlreadySubmitted({ statusTag }: { statusTag: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-400/15 text-3xl">
        ✓
      </div>
      <div>
        <p className="font-semibold text-foreground">今日已对齐</p>
        <p className="mt-1 text-sm text-muted-foreground">心境：{statusTag}</p>
      </div>
      <p className="max-w-[220px] text-xs text-muted-foreground leading-relaxed">
        今日记录已安全交托。明日内室将在 00:00 开放。
      </p>
      <Link
        href="/fellowship"
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white
                   hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/25"
      >
        前往团契小组
      </Link>
    </div>
  )
}

function formatChineseDate(d: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${days[d.getDay()]}`
}
