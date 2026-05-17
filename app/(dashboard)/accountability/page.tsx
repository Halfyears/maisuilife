import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Target, Plus, LogIn } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { todayCSTString, getWeekStartCST, getScheduledDates } from '@/lib/accountability'
import type { AccountabilityGroup, AccountabilityCheckin } from '@/types'

export const metadata = { title: '同行小组 — 麦穗喜乐' }
export const revalidate = 0

export default async function AccountabilityIndexPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createServiceClient()
  const today     = todayCSTString()
  const weekStart = getWeekStartCST()

  // Fetch all groups the user belongs to
  const { data: memberships } = await db
    .from('accountability_group_members')
    .select('group_id')
    .eq('user_id', user.id)

  const groupIds = (memberships ?? []).map(m => m.group_id)

  let groups: AccountabilityGroup[] = []
  let weekCheckins: AccountabilityCheckin[] = []

  if (groupIds.length > 0) {
    const [groupsRes, checkinsRes] = await Promise.all([
      db.from('accountability_groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false }),
      db.from('accountability_checkins')
        .select('group_id, user_id, checkin_date, status')
        .in('group_id', groupIds)
        .eq('user_id', user.id)
        .gte('checkin_date', weekStart)
        .lte('checkin_date', today),
    ])
    groups       = (groupsRes.data ?? []) as AccountabilityGroup[]
    weekCheckins = (checkinsRes.data ?? []) as AccountabilityCheckin[]
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">同行小组</h1>
          <Link
            href="/accountability/join"
            className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            加入
          </Link>
          <Link
            href="/accountability/create"
            className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5
                       text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            发起
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-32 space-y-3">

        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map(g => {
            const scheduled = getScheduledDates(
              Array.isArray(g.schedule_days_of_week) ? g.schedule_days_of_week : [],
              weekStart,
              today,
            )
            const myCheckins = weekCheckins.filter(c => c.group_id === g.id)
            const done = myCheckins.filter(c => c.status === 'done' && scheduled.includes(c.checkin_date)).length
            const rate = scheduled.length > 0 ? Math.round((done / scheduled.length) * 100) : null
            const todayChecked = myCheckins.some(c => c.checkin_date === today && c.status === 'done')
            const isOrganizer = g.organizer_id === user.id

            return (
              <Link
                key={g.id}
                href={`/accountability/${g.id}`}
                className="block rounded-2xl border border-stone-100 bg-white/90 px-5 py-4
                           shadow-sm shadow-amber-900/5 hover:border-amber-200 transition-colors
                           active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-stone-900">{g.name}</p>
                      {isOrganizer && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          召集人
                        </span>
                      )}
                    </div>
                    {g.goal_title && (
                      <p className="text-xs text-stone-500 mt-0.5 truncate">{g.goal_title}</p>
                    )}
                  </div>
                  {todayChecked ? (
                    <span className="shrink-0 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      ✓ 今日已打卡
                    </span>
                  ) : scheduled.includes(today) ? (
                    <span className="shrink-0 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      待打卡
                    </span>
                  ) : null}
                </div>

                {rate !== null && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-stone-400">本周完成率</span>
                      <span className="text-xs font-bold text-stone-700">{rate}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={[
                          'h-full rounded-full transition-all',
                          rate === 100 ? 'bg-green-400' :
                          rate >= 50  ? 'bg-amber-400' : 'bg-stone-300',
                        ].join(' ')}
                        style={{ width: `${Math.max(rate, 2)}%` }}
                      />
                    </div>
                  </>
                )}
              </Link>
            )
          })
        )}
      </main>

      <BottomNav />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full
                      bg-gradient-to-br from-amber-100 to-orange-100 text-3xl shadow-sm">
        🤝
      </div>
      <div>
        <p className="text-base font-bold text-stone-900">还未加入任何同行小组</p>
        <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
          同行小组可以跨团契组建，<br />为同一个目标彼此守望、相互激励。
        </p>
      </div>
      <div className="w-full space-y-3">
        <Link
          href="/accountability/create"
          className="flex items-center justify-center gap-2 w-full rounded-2xl
                     bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                     px-5 py-3.5 text-sm font-bold text-white
                     shadow-md shadow-orange-500/20 hover:opacity-90 transition-opacity active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          发起一个同行小组
        </Link>
        <Link
          href="/accountability/join"
          className="flex items-center justify-center gap-2 w-full rounded-2xl
                     border border-amber-200 bg-amber-50/80 px-5 py-3.5
                     text-sm font-bold text-amber-700 hover:bg-amber-100 transition-colors active:scale-[0.99]"
        >
          <LogIn className="h-4 w-4" />
          输入邀请码加入
        </Link>
      </div>
      <p className="text-xs text-stone-400 leading-relaxed">
        💡 不需要属于同一团契，任何人都可以发起或加入同行小组。
      </p>
    </div>
  )
}
