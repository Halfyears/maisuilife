import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Wheat } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DailyForm } from '@/components/daily/daily-form'
import { PastoralNotification } from '@/components/shared/pastoral-notification'
import { BottomNav } from '@/components/shared/bottom-nav'

export const metadata = { title: '今日内室 — 麦穗喜乐' }
export const revalidate = 0

// UTC+8 当地日期
function todayCN(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

export default async function DailyPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const today = todayCN()
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
      .from('users').select('display_name').eq('id', pastoralRes.data.leader_id).single()
    leaderName = leader?.display_name
  }

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Sticky header ──────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-stone-500
                       hover:bg-stone-100 hover:text-stone-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium">退出</span>
          </Link>

          <div className="flex flex-1 items-center justify-center gap-2">
            <Wheat className="h-4 w-4 text-amber-500" />
            <h1 className="text-sm font-bold text-stone-900 tracking-wide">今日内室</h1>
          </div>

          <span className="w-14 text-right text-[11px] text-stone-400">
            {formatDate(new Date())}
          </span>
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 pt-6 pb-32">

          {pastoralRes.data && (
            <div className="mb-5">
              <PastoralNotification requestId={pastoralRes.data.id} leaderName={leaderName} />
            </div>
          )}

          {existing ? (
            <AlreadySubmitted statusTag={existing.status_tag} />
          ) : (
            <DailyForm fellowshipId={fellowshipId} />
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

function AlreadySubmitted({ statusTag }: { statusTag: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full
                      bg-gradient-to-br from-amber-100 to-orange-100 text-3xl shadow-sm">
        ✓
      </div>
      <div>
        <p className="text-base font-bold text-stone-900 tracking-wide">今日已对齐</p>
        <p className="mt-1 text-sm font-medium text-stone-500">心境：{statusTag}</p>
      </div>
      <p className="max-w-[220px] text-xs text-stone-400 leading-relaxed">
        今日记录已安全交托，明日内室将在 00:00 开放。
      </p>
      <Link
        href="/fellowship"
        className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                   px-8 py-3 text-sm font-bold text-white tracking-wide
                   shadow-md shadow-amber-500/20 transition-all hover:opacity-90 active:scale-[0.98]"
      >
        前往麦穗团契
      </Link>
    </div>
  )
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}
