import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck, CalendarPlus, FileText, Settings } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { CheckinButton } from '@/components/accountability/checkin-button'
import { CopyCodeButton, CopyLinkButton } from '@/components/accountability/copy-code-button'
import { MemberProgressList } from '@/components/accountability/member-progress-list'
import {
  todayCSTString, getWeekStartCST, getScheduledDates,
  buildMemberProgress, DAY_LABEL, goalCategoryLabel,
} from '@/lib/accountability'
import type { AccountabilityGroup, AccountabilityCheckin } from '@/types'

export const revalidate = 0

export default async function AccountabilityGroupPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createAdminClient()
  const groupId = params.id

  // Verify membership
  const { data: memberRow } = await db
    .from('accountability_group_members')
    .select('display_name')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberRow) redirect('/accountability')

  // Fetch group + all members in parallel
  const [groupRes, membersRes] = await Promise.all([
    db.from('accountability_groups').select('*').eq('id', groupId).single(),
    db.from('accountability_group_members').select('user_id, display_name').eq('group_id', groupId),
  ])

  const group   = groupRes.data as AccountabilityGroup | null
  if (!group) redirect('/accountability')

  const members = (membersRes.data ?? []) as { user_id: string; display_name: string }[]
  const memberIds = members.map(m => m.user_id)

  // Date bounds
  const today     = todayCSTString()
  const weekStart = getWeekStartCST()
  const sixtyAgo  = new Date(Date.now() + 8 * 3_600_000 - 60 * 86_400_000).toISOString().slice(0, 10)

  const scheduleDays: number[] = Array.isArray(group.schedule_days_of_week)
    ? group.schedule_days_of_week as number[]
    : []

  const scheduledDates = getScheduledDates(scheduleDays, weekStart, today)
  const myTodayScheduled = scheduledDates.includes(today)

  // Fetch checkins
  const [weekCheckinsRes, histCheckinsRes, myHistoryRes] = await Promise.all([
    db.from('accountability_checkins')
      .select('*')
      .eq('group_id', groupId)
      .in('user_id', memberIds.length > 0 ? memberIds : [user.id])
      .gte('checkin_date', weekStart)
      .lte('checkin_date', today),
    db.from('accountability_checkins')
      .select('user_id, checkin_date, status')
      .eq('group_id', groupId)
      .gte('checkin_date', sixtyAgo)
      .lte('checkin_date', today),
    db.from('accountability_checkins')
      .select('id, checkin_date, status, note')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .order('checkin_date', { ascending: false })
      .limit(14),
  ])

  const weekCheckins = (weekCheckinsRes.data ?? []) as AccountabilityCheckin[]
  const histCheckins = (histCheckinsRes.data ?? []) as AccountabilityCheckin[]
  const myHistory    = (myHistoryRes.data ?? []) as AccountabilityCheckin[]

  // Build stats
  const memberProgress = buildMemberProgress(members, weekCheckins, histCheckins, scheduledDates, today, user.id)

  const totalDone = memberProgress.reduce((s, m) => s + m.completed, 0)
  const totalMax  = memberProgress.reduce((s, m) => s + m.total, 0)
  const overallRate = totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0

  const myCheckin = weekCheckins.find(c => c.user_id === user.id && c.checkin_date === today) ?? null
  const isOrganizer = group.organizer_id === user.id

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 leading-none">同行小组</p>
            <h1 className="text-sm font-bold text-stone-900 truncate">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/accountability/${groupId}/report`}
              className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                         px-2.5 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              报告
            </Link>
            {isOrganizer && (
              <Link
                href={`/accountability/${groupId}/settings`}
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                           px-2.5 py-1.5 text-xs font-medium text-stone-500
                           hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                设置
              </Link>
            )}
            <Link
              href="/accountability"
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                         px-3 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              列表
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-32 space-y-5">

        {/* ── 目标信息 ─────────────────────────────────────── */}
        {group.goal_title && (
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-orange-50/50 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">{goalCategoryLabel(group.goal_category ?? '')}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-900">{group.goal_title}</p>
                {group.goal_description && (
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{group.goal_description}</p>
                )}
                {scheduleDays.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
                    {scheduleDays.map(d => DAY_LABEL[d]).join('、')}
                    {group.schedule_time && ` · ${group.schedule_time}`}
                  </p>
                )}
                {(group.start_date || group.end_date) && (
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {group.start_date ?? '—'} 至 {group.end_date ?? '—'}
                  </p>
                )}
              </div>
            </div>
            {scheduleDays.length > 0 && (
              <a
                href={`/api/accountability/calendar?id=${groupId}`}
                download
                className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl
                           border border-amber-200 bg-white/70 px-4 py-3
                           text-sm font-bold text-amber-700
                           hover:bg-amber-100 active:scale-[0.98] transition-all"
              >
                <CalendarPlus className="h-4 w-4" />
                添加到日历
              </a>
            )}
          </div>
        )}

        {/* ── 邀请码 ──────────────────────────────────────── */}
        <InviteCodeCard code={group.invite_code} isOrganizer={isOrganizer} />

        {/* ── 本周进度 ─────────────────────────────────────── */}
        <WeeklyBanner rate={overallRate} done={totalDone} total={totalMax} count={memberProgress.length} />

        {/* ── 今日打卡 ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm shadow-amber-900/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">今日打卡</p>
              <p className="text-sm font-bold text-stone-900 mt-0.5">{today}</p>
            </div>
            {myCheckin && <StatusBadge status={myCheckin.status} />}
          </div>
          {myTodayScheduled ? (
            <CheckinButton
              groupId={groupId}
              today={today}
              currentStatus={myCheckin?.status ?? null}
              currentNote={myCheckin?.note ?? null}
            />
          ) : (
            <p className="text-xs text-stone-400 text-center py-2">今天不在约定打卡日 🌿</p>
          )}
        </div>

        {/* ── 成员进度 ─────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5 px-1">
            成员进度 · 本周
          </h2>
          <MemberProgressList members={memberProgress} myUserId={user.id} />
        </section>

        {/* ── 我的近期记录 ───────────────────────────────── */}
        {myHistory.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5 px-1">
              我的近期记录
            </h2>
            <div className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm">
              <div className="divide-y divide-stone-50">
                {myHistory.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <CalendarCheck className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-stone-600">{c.checkin_date}</span>
                      {c.note && <p className="text-xs text-stone-400 truncate mt-0.5">{c.note}</p>}
                    </div>
                    <StatusBadge status={c.status} />
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

// ── Sub-components ───────────────────────────────────────────────────────────

function InviteCodeCard({ code, isOrganizer }: {
  code: string; isOrganizer: boolean
}) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm">
      <p className="text-xs text-stone-400 mb-2">{isOrganizer ? '分享给想同行的人' : '小组邀请码'}</p>
      <p className="text-3xl font-black tracking-[0.3em] text-stone-900 mb-3">{code}</p>
      <div className="flex gap-2">
        <CopyCodeButton code={code} />
        <CopyLinkButton code={code} />
      </div>
    </div>
  )
}


function WeeklyBanner({ rate, done, total, count }: {
  rate: number; done: number; total: number; count: number
}) {
  const grad =
    rate >= 80 ? 'from-green-500 to-emerald-500' :
    rate >= 50 ? 'from-amber-500 to-orange-500'  :
                 'from-stone-400 to-stone-500'
  const msg =
    rate === 100 ? '🎉 本周全员完成！' :
    rate >= 80   ? '💪 快完成了，继续加油！' :
    rate >= 50   ? '🌱 已过半，同行向前！' :
    total === 0  ? '本周暂无约定打卡日' :
                   '🤝 一起同行，彼此守望'

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm shadow-amber-900/5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">本周团体完成率</p>
          <p className={`text-4xl font-black mt-1 bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>
            {rate}<span className="text-2xl">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-400">{done} / {total} 次</p>
          <p className="text-xs text-stone-400 mt-0.5">{count} 位同行者</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`}
          style={{ width: `${Math.max(rate, 2)}%` }}
        />
      </div>
      <p className="text-xs text-stone-500 mt-2.5 font-medium">{msg}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: 'done' | 'missed' | 'postponed' }) {
  if (status === 'done')      return <span className="text-[11px] font-bold text-green-700 bg-green-50 rounded-full px-2.5 py-1">✓ 完成</span>
  if (status === 'missed')    return <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded-full px-2.5 py-1">✗ 未完成</span>
  return <span className="text-[11px] font-bold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">⏳ 延期</span>
}
