import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DoorOpen } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { todayLocal } from '@/lib/date'
import { LocalDailyDate } from '@/components/shared/local-date-display'
import { DailyForm } from '@/components/daily/daily-form'
import { PastoralNotification } from '@/components/shared/pastoral-notification'
import { BottomNav } from '@/components/shared/bottom-nav'

export const metadata = { title: '今日内室 — 麦穗喜乐' }
export const revalidate = 0


export default async function DailyPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const today = todayLocal()
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
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          {/* 左：日期（读设备本地时间） */}
          <LocalDailyDate />

          {/* 右：退出按钮 */}
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-2 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <DoorOpen className="h-4 w-4" />
            退出内室
          </Link>
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
        <p className="text-base font-bold text-stone-900 tracking-wide">今日心声已放在祂面前</p>
        <p className="mt-1 text-sm font-medium text-stone-500">心境：{statusTag}</p>
      </div>
      <p className="max-w-[220px] text-xs text-stone-400 leading-relaxed">
        今日祷告已记录，明日内室将在午夜 00:00 重新开放。
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

