import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck, CalendarPlus, FileText, Settings } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { todayLocal, offsetDate } from '@/lib/date'
import { BottomNav } from '@/components/shared/bottom-nav'
import { CheckinButton } from '@/components/accountability/checkin-button'
import { CopyCodeButton, CopyLinkButton } from '@/components/accountability/copy-code-button'
import { MemberProgressList } from '@/components/accountability/member-progress-list'
import { VigilPanel } from '@/components/accountability/vigil-panel'
import { LeaveGroupButton } from '@/components/accountability/leave-group-button'
import {
  getWeekStart, getScheduledDates,
  buildMemberProgress, DAY_LABEL, goalCategoryLabel,
} from '@/lib/accountability'
import type { AccountabilityGroup, AccountabilityCheckin, VigilPresence } from '@/types'

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

  // 查询角色（super_admin 可绕过成员校验）
  const { data: callerProfile } = await db
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()
  const isSuperAdmin = callerProfile?.role === 'super_admin'

  // Verify membership — super_admin 直接进入（仅活跃成员）
  const { data: memberRow } = await db
    .from('accountability_group_members')
    .select('display_name, status')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  // 已退出/被移除的成员也重定向
  if ((!memberRow || memberRow.status !== 'active') && !isSuperAdmin) redirect('/accountability')

  // Fetch group + active members in parallel
  const [groupRes, membersRes] = await Promise.all([
    db.from('accountability_groups').select('*').eq('id', groupId).single(),
    db.from('accountability_group_members')
      .select('user_id, display_name, status')
      .eq('group_id', groupId)
      .eq('status', 'active'),  // 仅活跃成员计入进度和名单
  ])

  const group   = groupRes.data as AccountabilityGroup | null
  if (!group) redirect('/accountability')

  const members = (membersRes.data ?? []) as { user_id: string; display_name: string }[]
  const memberIds = members.map(m => m.user_id)

  const today     = todayLocal()
  const isOrganizer = group.organizer_id === user.id
  const isVigil     = group.group_type === 'vigil'

  // ── Vigil track: fetch today's presences + prayer log ─────
  let vigilPresences:  VigilPresence[] = []
  let myVigilPresence: VigilPresence | null = null
  let initialPrayers:  { id: string; user_id: string; display_name: string; note: string | null; created_at: string }[] = []

  if (isVigil) {
    const [vpRes, prayersRes] = await Promise.all([
      db.from('accountability_vigil_presences')
        .select('user_id, note, created_at')
        .eq('group_id', groupId)
        .eq('presence_date', today)
        .order('created_at'),
      db.from('accountability_vigil_prayers')
        .select('id, user_id, display_name, note, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const nameMap: Record<string, string> = {}
    for (const m of members) nameMap[m.user_id] = m.display_name

    vigilPresences = ((vpRes.data ?? []) as { user_id: string; note: string | null; created_at: string }[]).map(p => ({
      user_id:      p.user_id,
      display_name: nameMap[p.user_id] ?? '同行者',
      note:         p.note,
      created_at:   p.created_at,
    }))
    myVigilPresence = vigilPresences.find(p => p.user_id === user.id) ?? null
    initialPrayers  = (prayersRes.data ?? []) as typeof initialPrayers
  }

  // ── Daily track: fetch checkins ────────────────────────────
  const weekStart    = getWeekStart(today)
  const sixtyAgo     = offsetDate(today, -60)
  const scheduleDays: number[] = Array.isArray(group.schedule_days_of_week)
    ? group.schedule_days_of_week as number[] : []
  const scheduledDates   = getScheduledDates(scheduleDays, weekStart, today)
  const myTodayScheduled = scheduledDates.includes(today)

  let weekCheckins:  AccountabilityCheckin[] = []
  let memberProgress = [] as ReturnType<typeof buildMemberProgress>
  let overallRate = 0
  let myCheckin: AccountabilityCheckin | null = null
  let myHistory: AccountabilityCheckin[] = []

  if (!isVigil) {
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

    weekCheckins  = (weekCheckinsRes.data ?? []) as AccountabilityCheckin[]
    const histCheckins = (histCheckinsRes.data ?? []) as AccountabilityCheckin[]
    myHistory     = (myHistoryRes.data ?? []) as AccountabilityCheckin[]
    memberProgress = buildMemberProgress(members, weekCheckins, histCheckins, scheduledDates, today, user.id)
    const totalDone = memberProgress.reduce((s, m) => s + m.completed, 0)
    const totalMax  = memberProgress.reduce((s, m) => s + m.total, 0)
    overallRate = totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0
    myCheckin   = weekCheckins.find(c => c.user_id === user.id && c.checkin_date === today) ?? null
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3.5">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-stone-900 truncate">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isVigil && (
              <Link
                href={`/accountability/${groupId}/report`}
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                           px-2.5 py-1.5 text-xs font-medium text-stone-500
                           hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                报告
              </Link>
            )}
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

      {/* 超管模式提示横幅 */}
      {isSuperAdmin && !memberRow && (
        <div className="bg-violet-600 text-white text-xs font-semibold px-5 py-2 text-center">
          🛡️ 超管模式 · 只读浏览，如需操作请先在管理中枢接管此小组
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-32 space-y-5">

        {/* ── 守望相助视图 ─────────────────────────────────── */}
        {isVigil ? (
          <>
            {/* 守望情况卡片 */}
            <div className="rounded-2xl border border-violet-200/60 overflow-hidden shadow-sm"
              style={{ background: 'linear-gradient(135deg, #fdf4ff 0%, #fff8ee 60%, #fef3e2 100%)' }}>
              <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #c084fc, #d4af37, #c084fc)' }} />
              <div className="px-5 py-4">
                {/* 类型标题行 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🕊️</span>
                    <p className="text-sm font-bold text-violet-700">守望相助</p>
                  </div>
                  {isOrganizer && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      召集人
                    </span>
                  )}
                </div>
                {/* 内容区 */}
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0">{goalCategoryLabel(group.goal_category ?? '')}</span>
                  <div className="flex-1 min-w-0">
                    {group.goal_title && (
                      <p className="text-sm font-semibold text-stone-800">{group.goal_title}</p>
                    )}
                    {group.goal_description && (
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{group.goal_description}</p>
                    )}
                    {scheduleDays.length > 0 && (
                      <p className="text-[11px] text-violet-600 mt-1.5 font-medium">
                        每周{scheduleDays.map(d => DAY_LABEL[d]).join('、')}同心守望
                        {group.schedule_time && ` · ${group.schedule_time}`}
                      </p>
                    )}
                    {(group.start_date || group.end_date) && (
                      <p className="text-[11px] text-amber-500 mt-0.5">
                        {group.start_date ?? '—'} 至 {group.end_date ?? '持续守望'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 守望互动面板 */}
            <VigilPanel
              groupId={groupId}
              myPresence={myVigilPresence}
              initialPresences={vigilPresences}
              initialPrayers={initialPrayers}
              memberCount={members.length}
              myUserId={user.id}
            />

            {/* 邀请码 */}
            <InviteCodeCard code={group.invite_code} name={group.name} isOrganizer={isOrganizer} isVigil />

            {/* 普通成员退出按钮 */}
            {!isOrganizer && !isSuperAdmin && (
              <LeaveGroupButton groupId={groupId} />
            )}
          </>
        ) : (
          <>
            {/* ── 今日打卡 ─────────────────────────────────── */}
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

            {/* ── 目标信息 ─────────────────────────────────── */}
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

            {/* ── 邀请码 ──────────────────────────────────── */}
            <InviteCodeCard code={group.invite_code} name={group.name} isOrganizer={isOrganizer} />

            {/* ── 本周进度 ─────────────────────────────────── */}
            <WeeklyBanner
              rate={overallRate}
              done={memberProgress.reduce((s, m) => s + m.completed, 0)}
              total={memberProgress.reduce((s, m) => s + m.total, 0)}
              count={memberProgress.length}
            />

            {/* ── 成员进度 ─────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5 px-1">
                成员进度 · 本周
              </h2>
              <MemberProgressList members={memberProgress} myUserId={user.id} />
            </section>

            {/* ── 普通成员退出按钮 ─────────────────────────── */}
            {!isOrganizer && !isSuperAdmin && (
              <LeaveGroupButton groupId={groupId} />
            )}

            {/* ── 我的近期记录 ─────────────────────────────── */}
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
          </>
        )}

      </main>

      <BottomNav />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InviteCodeCard({ code, name, isOrganizer, isVigil = false }: {
  code: string; name: string; isOrganizer: boolean; isVigil?: boolean
}) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm">
      <p className="text-xs text-stone-400 mb-2">
        {isOrganizer
          ? (isVigil ? '邀请肢体一起守望' : '分享给想同行的人')
          : '小组邀请码'}
      </p>
      <p className="text-3xl font-black tracking-[0.3em] text-stone-900 mb-3">{code}</p>
      <div className="flex gap-2">
        <CopyCodeButton code={code} />
        <CopyLinkButton code={code} name={name} isVigil={isVigil} />
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
