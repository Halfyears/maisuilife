import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Award, Target, TrendingUp } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DAY_LABEL, consecutiveDays } from '@/lib/accountability'
import { todayLocal } from '@/lib/date'
import type { AccountabilityGroup, AccountabilityCheckin } from '@/types'

export const revalidate = 0

export default async function AccountabilityReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createAdminClient()
  const groupId = params.id

  const { data: memberRow } = await db
    .from('accountability_group_members')
    .select('display_name')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberRow) redirect('/accountability')

  const [groupRes, membersRes, allCheckinsRes] = await Promise.all([
    db.from('accountability_groups').select('*').eq('id', groupId).single(),
    db.from('accountability_group_members').select('user_id, display_name').eq('group_id', groupId),
    db.from('accountability_checkins')
      .select('user_id, checkin_date, status')
      .eq('group_id', groupId)
      .order('checkin_date', { ascending: true }),
  ])

  const group = groupRes.data as AccountabilityGroup | null
  if (!group) redirect('/accountability')

  const members = (membersRes.data ?? []) as { user_id: string; display_name: string }[]
  const allCheckins = (allCheckinsRes.data ?? []) as AccountabilityCheckin[]

  const today    = todayLocal()
  const isEnded  = !!group.end_date && group.end_date < today
  const isFinal  = isEnded

  // Build per-member stats over entire history
  const scheduleDays: number[] = Array.isArray(group.schedule_days_of_week)
    ? group.schedule_days_of_week : []

  // Calculate all scheduled dates in the group's range
  function getAllScheduledDates(): string[] {
    if (!scheduleDays.length) return []
    const startStr = group!.start_date ?? (allCheckins[0]?.checkin_date ?? today)
    const endStr   = group!.end_date ?? today
    const dates: string[] = []
    const cursor = new Date(startStr + 'T00:00:00Z')
    const end    = new Date(endStr + 'T00:00:00Z')
    while (cursor <= end) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const specDay = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay()
      if (scheduleDays.includes(specDay)) dates.push(dateStr)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return dates
  }

  const scheduledDates = getAllScheduledDates()
  const totalExpected  = scheduledDates.length

  interface MemberStat {
    user_id:     string
    name:        string
    done:        number
    missed:      number
    postponed:   number
    rate:        number
    bestStreak:  number
  }

  const memberStats: MemberStat[] = members.map(m => {
    const mCheckins = allCheckins.filter(c => c.user_id === m.user_id)
    const done      = mCheckins.filter(c => c.status === 'done').length
    const missed    = mCheckins.filter(c => c.status === 'missed').length
    const postponed = mCheckins.filter(c => c.status === 'postponed').length
    const rate      = totalExpected > 0 ? Math.round((done / totalExpected) * 100) : 0

    // Best streak: find max consecutive done days
    const doneSet = new Set(mCheckins.filter(c => c.status === 'done').map(c => c.checkin_date))
    let bestStreak = 0, curStreak = 0
    for (const d of scheduledDates) {
      if (doneSet.has(d)) { curStreak++; bestStreak = Math.max(bestStreak, curStreak) }
      else curStreak = 0
    }

    return { user_id: m.user_id, name: m.display_name, done, missed, postponed, rate, bestStreak }
  }).sort((a, b) => b.rate - a.rate || b.bestStreak - a.bestStreak)

  const totalDone   = memberStats.reduce((s, m) => s + m.done, 0)
  const groupRate   = totalExpected > 0 && memberStats.length > 0
    ? Math.round((totalDone / (totalExpected * memberStats.length)) * 100)
    : 0

  const currentStreak = consecutiveDays(
    allCheckins.filter(c => c.user_id === user.id),
    today,
  )

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <TrendingUp className="h-4 w-4 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">
            {isFinal ? '同行总结报告' : '阶段进度报告'}
          </h1>
          <Link
            href={`/accountability/${groupId}`}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-24 space-y-5">

        {/* Group header */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-5">
          <div className="flex items-start gap-3 mb-3">
            <Target className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-black text-stone-900">{group.name}</p>
              {group.goal_title && (
                <p className="text-sm text-stone-600 mt-0.5">{group.goal_title}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
            {scheduleDays.length > 0 && (
              <span>📅 {scheduleDays.map(d => DAY_LABEL[d]).join('、')}</span>
            )}
            {group.start_date && <span>开始：{group.start_date}</span>}
            {group.end_date   && <span>结束：{group.end_date}</span>}
            <span>成员：{memberStats.length} 人</span>
          </div>
          {isFinal && (
            <div className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800">
              🎉 同行旅程已圆满完成！感谢每一位同行者的坚持。
            </div>
          )}
        </div>

        {/* Overall stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '团体完成率', value: `${groupRate}%`, sub: '全员平均' },
            { label: '约定打卡日', value: `${totalExpected}`, sub: '次' },
            { label: '我的连续打卡', value: `${currentStreak}`, sub: '天' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl border border-stone-100 bg-white/90 px-3 py-4 shadow-sm text-center">
              <p className="text-2xl font-black text-stone-900">{value}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>
              <p className="text-[10px] font-medium text-stone-500 mt-1 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Member leaderboard */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5 px-1">
            成员完成排名
          </h2>
          <div className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm">
            <div className="divide-y divide-stone-50">
              {memberStats.map((m, idx) => {
                const isSelf = m.user_id === user.id
                const medal  = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                return (
                  <div key={m.user_id} className={['px-5 py-4', isSelf ? 'bg-amber-50/40' : ''].join(' ')}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl w-7 text-center shrink-0">
                        {medal ?? <span className="text-sm font-bold text-stone-400">{idx + 1}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isSelf ? 'text-amber-700' : 'text-stone-900'}`}>
                          {m.name}
                          {isSelf && <span className="ml-1 text-xs font-normal text-amber-500">（我）</span>}
                        </p>
                        <div className="flex gap-3 text-[11px] text-stone-400 mt-0.5">
                          <span>✓ {m.done} 次</span>
                          {m.missed > 0 && <span>✗ {m.missed} 次</span>}
                          {m.bestStreak > 0 && <span>🔥 最长 {m.bestStreak} 天连续</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-stone-900">
                          {m.rate}<span className="text-xs font-medium text-stone-400">%</span>
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden ml-10">
                      <div
                        className={[
                          'h-full rounded-full transition-all',
                          m.rate === 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                          m.rate >= 60   ? 'bg-gradient-to-r from-amber-400 to-orange-400'  : 'bg-stone-300',
                        ].join(' ')}
                        style={{ width: `${Math.max(m.rate, 2)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Perfect members */}
        {memberStats.filter(m => m.rate === 100).length > 0 && (
          <div className="rounded-2xl border border-green-100 bg-green-50/80 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-green-600" />
              <p className="text-xs font-bold text-green-800">全勤成员</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {memberStats.filter(m => m.rate === 100).map(m => (
                <span key={m.user_id} className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isFinal && (
          <p className="text-center text-xs text-stone-400 pb-2">
            📊 报告将在结束日期后显示完整总结
          </p>
        )}

      </main>
    </div>
  )
}
