import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Target, CalendarCheck } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CheckinButton } from '@/components/fellowship/accountability/checkin-button'
import { MemberProgressList } from '@/components/fellowship/accountability/member-progress-list'
import { BottomNav } from '@/components/shared/bottom-nav'
import type { MemberProgress, AccountabilityCheckin } from '@/types'

export const metadata = { title: '同行打卡 — 麦穗喜乐' }
export const revalidate = 0

// ── helpers ─────────────────────────────────────────────────────────────────

function todayCSTString(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

function getWeekStartCST(): string {
  const now = new Date(Date.now() + 8 * 3_600_000)
  const day = now.getUTCDay()           // 0=Sun
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diff)
  return monday.toISOString().slice(0, 10)
}

// Returns dates that should have checkins this week, up to and including today
function getScheduledDates(scheduleDays: number[], weekStart: string, today: string): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    if (dateStr > today) break
    // spec: 1=Mon…7=Sun; JS getUTCDay: 0=Sun…6=Sat
    const specDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    if (scheduleDays.includes(specDay)) dates.push(dateStr)
  }
  return dates
}

// Count consecutive done days from today backwards
function consecutiveDays(
  checkins: AccountabilityCheckin[],
  today: string
): number {
  const doneSet = new Set(
    checkins.filter(c => c.status === 'done').map(c => c.checkin_date)
  )
  let count = 0
  let cursor = new Date(today + 'T00:00:00Z')
  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10)
    if (!doneSet.has(dateStr)) break
    count++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    if (count > 365) break
  }
  return count
}

const GOAL_CATEGORY_LABEL: Record<string, string> = {
  prayer:       '🙏 祷告',
  bible_reading:'📖 读经',
  custom:       '✨ 自定义',
}

const DAY_LABEL = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

// ── page ────────────────────────────────────────────────────────────────────

export default async function AccountabilityPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createServiceClient()

  // 1. Find membership
  const { data: membershipRow } = await db
    .from('fellowship_members')
    .select('fellowship_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membershipRow) redirect('/fellowship')

  const fellowshipId = membershipRow.fellowship_id

  // 2. Fetch fellowship + members in parallel
  const [{ data: fellowship }, { data: members }] = await Promise.all([
    db.from('fellowships')
      .select('id, name, leader_id, fellowship_type, goal_title, goal_description, goal_category, goal_start_date, goal_end_date, schedule_days_of_week, schedule_time')
      .eq('id', fellowshipId)
      .single(),
    db.from('fellowship_members')
      .select('user_id, layer2_label')
      .eq('fellowship_id', fellowshipId),
  ])

  if (!fellowship) redirect('/fellowship')
  if (fellowship.fellowship_type !== 'accountability') redirect('/fellowship')

  const memberList = (members ?? []) as { user_id: string; layer2_label: string }[]
  const memberIds  = memberList.map(m => m.user_id)

  // 3. Compute week bounds
  const today     = todayCSTString()
  const weekStart = getWeekStartCST()

  const scheduleDays: number[] = Array.isArray(fellowship.schedule_days_of_week)
    ? (fellowship.schedule_days_of_week as number[])
    : []

  const scheduledDates = getScheduledDates(scheduleDays, weekStart, today)
  const totalThisWeek  = scheduledDates.length

  // 4. Fetch all checkins for this week
  const { data: weekCheckins } = await db
    .from('accountability_checkins')
    .select('*')
    .eq('fellowship_id', fellowshipId)
    .in('user_id', memberIds.length > 0 ? memberIds : [user.id])
    .gte('checkin_date', weekStart)
    .lte('checkin_date', today)

  const allCheckins = (weekCheckins ?? []) as AccountabilityCheckin[]

  // 5. Fetch a longer history for consecutive-days calculation (last 60 days)
  const sixtyDaysAgo = new Date(Date.now() + 8 * 3_600_000 - 60 * 86_400_000).toISOString().slice(0, 10)
  const { data: histCheckins } = await db
    .from('accountability_checkins')
    .select('user_id, checkin_date, status')
    .eq('fellowship_id', fellowshipId)
    .gte('checkin_date', sixtyDaysAgo)
    .lte('checkin_date', today)

  const histByUser: Record<string, AccountabilityCheckin[]> = {}
  for (const c of (histCheckins ?? []) as AccountabilityCheckin[]) {
    if (!histByUser[c.user_id]) histByUser[c.user_id] = []
    histByUser[c.user_id].push(c)
  }

  // 6. Build member progress
  const labelByUser = Object.fromEntries(memberList.map(m => [m.user_id, m.layer2_label]))

  const memberProgress: MemberProgress[] = memberList.map(m => {
    const mCheckins = allCheckins.filter(c => c.user_id === m.user_id)
    const done = mCheckins.filter(c => c.status === 'done' && scheduledDates.includes(c.checkin_date)).length
    const rate = totalThisWeek > 0 ? Math.round((done / totalThisWeek) * 100) : 0
    const cons = consecutiveDays(histByUser[m.user_id] ?? [], today)
    const todayC = mCheckins.find(c => c.checkin_date === today) ?? null

    return {
      user_id:          m.user_id,
      user_name:        m.layer2_label || '同行者',
      completed:        done,
      total:            totalThisWeek,
      completion_rate:  rate,
      consecutive_days: cons,
      status:           rate === 100 ? 'perfect' : rate >= 50 ? 'on_track' : 'missing',
      today_status:     todayC ? todayC.status : null,
    }
  })

  memberProgress.sort((a, b) =>
    b.completion_rate - a.completion_rate ||
    b.consecutive_days - a.consecutive_days
  )

  // 7. Overall week stats
  const totalDone = memberProgress.reduce((s, m) => s + m.completed, 0)
  const totalMax  = memberProgress.reduce((s, m) => s + m.total, 0)
  const overallRate = totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0

  // 8. My today's checkin
  const myCheckin = allCheckins.find(c => c.user_id === user.id && c.checkin_date === today) ?? null
  const myTodayScheduled = scheduledDates.includes(today)

  // 9. Recent history (last 14 days) for viewer
  const { data: myHistory } = await db
    .from('accountability_checkins')
    .select('id, checkin_date, status, note, created_at')
    .eq('fellowship_id', fellowshipId)
    .eq('user_id', user.id)
    .order('checkin_date', { ascending: false })
    .limit(14)

  const recentHistory = (myHistory ?? []) as AccountabilityCheckin[]
  const isLeader = fellowship.leader_id === user.id

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 leading-none">同行打卡</p>
            <h1 className="text-sm font-bold text-stone-900 truncate">{fellowship.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLeader && (
              <Link
                href="/fellowship/console/accountability-setup"
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                           px-2.5 py-1.5 text-xs font-medium text-stone-500
                           hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                设置
              </Link>
            )}
            <Link
              href="/fellowship"
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                         px-3 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              团契
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-32 space-y-5">

        {/* ── 目标信息 ──────────────────────────────────────────── */}
        {fellowship.goal_title && (
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-orange-50/50 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {GOAL_CATEGORY_LABEL[fellowship.goal_category ?? ''] ?? '✨'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-900">{fellowship.goal_title}</p>
                {fellowship.goal_description && (
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{fellowship.goal_description}</p>
                )}
                {scheduleDays.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
                    {scheduleDays.map(d => DAY_LABEL[d]).join('、')}
                    {fellowship.schedule_time && ` · ${fellowship.schedule_time}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 本周进度横幅 ──────────────────────────────────────── */}
        <WeeklyBanner
          rate={overallRate}
          done={totalDone}
          total={totalMax}
          memberCount={memberProgress.length}
        />

        {/* ── 今日打卡 ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm shadow-amber-900/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">今日打卡</p>
              <p className="text-sm font-bold text-stone-900 mt-0.5">{today}</p>
            </div>
            {myCheckin && (
              <CheckinStatusBadge status={myCheckin.status} />
            )}
          </div>

          {myTodayScheduled ? (
            <CheckinButton
              fellowshipId={fellowshipId}
              today={today}
              currentStatus={myCheckin?.status ?? null}
              currentNote={myCheckin?.note ?? null}
            />
          ) : (
            <p className="text-xs text-stone-400 text-center py-2">今天不在约定打卡日，休息一下 🌿</p>
          )}
        </div>

        {/* ── 成员进度排行 ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5 px-1">
            成员进度 · 本周
          </h2>
          <MemberProgressList members={memberProgress} myUserId={user.id} />
        </section>

        {/* ── 我的打卡记录 ─────────────────────────────────────── */}
        {recentHistory.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5 px-1">
              我的近期记录
            </h2>
            <div className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm">
              <div className="divide-y divide-stone-50">
                {recentHistory.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <CalendarCheck className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-stone-600">{c.checkin_date}</span>
                      {c.note && (
                        <p className="text-xs text-stone-400 truncate mt-0.5">{c.note}</p>
                      )}
                    </div>
                    <CheckinStatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

      <BottomNav />
    </div>
  )
}

// ── Sub-components (server-rendered) ────────────────────────────────────────

function WeeklyBanner({ rate, done, total, memberCount }: {
  rate: number; done: number; total: number; memberCount: number
}) {
  const color =
    rate >= 80 ? 'from-green-500 to-emerald-500' :
    rate >= 50 ? 'from-amber-500 to-orange-500' :
                 'from-stone-400 to-stone-500'

  const message =
    rate === 100 ? '🎉 本周全员完成！' :
    rate >= 80   ? '💪 快完成了，继续加油！' :
    rate >= 50   ? '🌱 已过半，坚持同行！' :
    total === 0  ? '本周暂无约定打卡日' :
                   '🤝 一起同行，彼此守望'

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm shadow-amber-900/5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">本周团体完成率</p>
          <p className={`text-4xl font-black mt-1 bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
            {rate}<span className="text-2xl">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-400">{done} / {total} 次</p>
          <p className="text-xs text-stone-400 mt-0.5">{memberCount} 位同行者</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${Math.max(rate, 2)}%` }}
        />
      </div>
      <p className="text-xs text-stone-500 mt-2.5 font-medium">{message}</p>
    </div>
  )
}

function CheckinStatusBadge({ status }: { status: 'done' | 'missed' | 'postponed' }) {
  if (status === 'done') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
      ✓ 完成
    </span>
  )
  if (status === 'missed') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
      ✗ 未完成
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
      ⏳ 延期
    </span>
  )
}
