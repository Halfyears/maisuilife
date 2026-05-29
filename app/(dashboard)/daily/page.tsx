import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DoorOpen } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { todayLocal } from '@/lib/date'
import { DailyForm } from '@/components/daily/daily-form'
import { PastoralNotification } from '@/components/shared/pastoral-notification'
import { BottomNav } from '@/components/shared/bottom-nav'
import { GlobalNotice } from '@/components/shared/global-notice'
import { DonationWidget } from '@/components/shared/donation-widget'

export const metadata = { title: '今日内室 — 麦穗喜乐' }
export const revalidate = 0


export default async function DailyPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const today = todayLocal()
  const db    = createServiceClient()

  // Format display date from cookie-based local date (YYYY-MM-DD)
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
  const todayDate   = new Date(today + 'T12:00:00')
  const displayDate = `${todayDate.getMonth() + 1}月${todayDate.getDate()}日 · 星期${WEEKDAYS[todayDate.getDay()]}`

  const [alignmentRes, membershipRes, pastoralRes, logRes] = await Promise.all([
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

    // 今日 AI 生成的经文（用于已提交后的锁定视图，与首页公共经文不同）
    // .limit(1) + data?.[0] 比 .maybeSingle() 更安全，避免 PGRST116 多行异常
    supabase
      .from('spiritual_logs')
      .select('bible_verse, bible_ref')
      .eq('user_id', user.id)
      .eq('client_date', today)
      .not('bible_verse', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const existing     = alignmentRes.data
  // 非关键路径：查询失败时静默降级，锁定视图仍可正常显示（只是没有经文）
  if (logRes.error) console.error('[daily] spiritual_logs query error:', logRes.error.message)
  const todayLog     = logRes.data?.[0] ?? null
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
          {/* 左：标题 + 日期 */}
          <div>
            <p className="text-xl font-black leading-none text-stone-900 tracking-wide">今日内室</p>
            <p className="text-[11px] text-stone-400 mt-1">{displayDate}</p>
          </div>

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

      <GlobalNotice />

      {/* ── Scrollable content ─────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 pt-6 pb-32 space-y-5">

          {pastoralRes.data && (
            <PastoralNotification requestId={pastoralRes.data.id} leaderName={leaderName} />
          )}

          {/* 内室始终开放：今日已提交时以只读模式显示，0点后恢复输入 */}
          <DailyForm
            fellowshipId={fellowshipId}
            existingAlignment={existing ? {
              id:          existing.id,
              status_tag:  existing.status_tag,
              bible_verse: todayLog?.bible_verse ?? null,
              bible_ref:   todayLog?.bible_ref   ?? null,
            } : null}
          />

          <DonationWidget pageKey="daily" />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}


