import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, BookOpen, Wheat } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { todayLocal, offsetDate } from '@/lib/date'
import { LocalDateChip } from '@/components/shared/local-date-display'
import { BottomNav } from '@/components/shared/bottom-nav'
import { TimeGreeting } from '@/components/home/time-greeting'
import { getWeekStart, getScheduledDates } from '@/lib/accountability'
import { getAutoScripture } from '@/lib/scripture-pool'

export const metadata = { title: '首页' }
export const revalidate = 0

function computeStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const yesterday = offsetDate(today, -1)
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i + 1]).getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }
  return streak
}

export default async function RootPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db     = createAdminClient()
  const today  = todayLocal()
  const thirtyThreeAgo = offsetDate(today, -33)

  // ── Round 1: user data + memberships (all parallel) ────────────────
  const [profileRes, alignmentRes, streakDatesRes, fellowshipMemberRes, acctMemberRes, scriptureRes] =
    await Promise.all([
      supabase.from('users').select('display_name').eq('id', user.id).single(),
      supabase.from('daily_alignments').select('status_tag').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('daily_alignments').select('date').eq('user_id', user.id)
        .gte('date', thirtyThreeAgo).order('date', { ascending: false }),
      supabase.from('fellowship_members').select('fellowship_id').eq('user_id', user.id).limit(1).maybeSingle(),
      // 仅查询仍为 active 的成员关系（已退出/已被移除不计入）
      db.from('accountability_group_members').select('group_id').eq('user_id', user.id).eq('status', 'active'),
      // 今日经文：与教会管理中枢同源，管理员手动覆盖优先，否则自动轮换
      db.from('system_configs').select('value').eq('key', 'daily_scripture').maybeSingle(),
    ])

  const fellowshipId  = fellowshipMemberRes.data?.fellowship_id ?? null
  const acctGroupIds  = (acctMemberRes.data ?? []).map((m: { group_id: string }) => m.group_id)
  const streak        = computeStreak((streakDatesRes.data ?? []).map((r: { date: string }) => r.date), today)

  // ── Round 2: depends on Round 1 (all parallel) ─────────────────────
  const [sessionRes, prayerCountRes, acctGroupsRes, checkinsRes, vigilRes] = await Promise.all([
    fellowshipId
      ? db.from('fellowship_sessions').select('state').eq('fellowship_id', fellowshipId)
          .in('state', ['checkin', 'harvest']).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    fellowshipId
      ? db.from('prayer_requests').select('id', { count: 'exact', head: true })
          .eq('fellowship_id', fellowshipId).eq('is_resolved', false)
      : Promise.resolve({ count: 0, data: null }),
    acctGroupIds.length
      ? db.from('accountability_groups')
          .select('id, name, group_type, schedule_days_of_week, status')
          .in('id', acctGroupIds)
          .eq('status', 'active')           // 仅显示进行中小组，已结束小组不出现在首页
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    acctGroupIds.length
      ? db.from('accountability_checkins').select('group_id, status').in('group_id', acctGroupIds)
          .eq('user_id', user.id).eq('checkin_date', today)
      : Promise.resolve({ data: [] }),
    // Vigil presences — wrapped so migration not-yet-run silently yields []
    acctGroupIds.length
      ? (async () => {
          try {
            return await db.from('accountability_vigil_presences').select('group_id')
              .in('group_id', acctGroupIds).eq('user_id', user.id).eq('presence_date', today)
          } catch { return { data: [] } }
        })()
      : Promise.resolve({ data: [] }),
  ])

  // ── Derived state ───────────────────────────────────────────────────
  const todayAlignment  = alignmentRes.data
  const sessionActive   = !!(sessionRes.data?.state)
  const prayerCount     = (prayerCountRes as { count?: number | null }).count ?? 0
  const firstName       = profileRes.data?.display_name ?? '朋友'

  // 今日经文：与教会中枢同源 — 管理员手动经文优先，否则按天序自动轮换
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scriptureVal = (scriptureRes.data as any)?.value as { verse?: string; ref?: string; manual_date?: string } | null
  const isManualToday = scriptureVal?.manual_date === today
  const autoScripture = getAutoScripture()
  const scripture = {
    verse: isManualToday ? (scriptureVal?.verse?.trim() || autoScripture.verse) : autoScripture.verse,
    ref:   isManualToday ? (scriptureVal?.ref?.trim()   || autoScripture.ref)   : autoScripture.ref,
  }

  type GroupRow = { id: string; name: string; group_type: string; schedule_days_of_week: number[] }
  const allGroups  = (acctGroupsRes.data ?? []) as GroupRow[]
  const dailyGroups = allGroups.filter(g => g.group_type !== 'vigil')
  const vigilGroups = allGroups.filter(g => g.group_type === 'vigil')

  const checkinsToday    = (checkinsRes.data ?? []) as { group_id: string; status: string }[]
  const vigilWatchedIds  = new Set(
    ((vigilRes as { data: { group_id: string }[] | null }).data ?? []).map(r => r.group_id)
  )

  const weekStart = getWeekStart(today)
  const pendingDailyCount = dailyGroups.filter(g => {
    const scheduledToday = getScheduledDates(
      Array.isArray(g.schedule_days_of_week) ? g.schedule_days_of_week : [],
      weekStart, today,
    ).includes(today)
    if (!scheduledToday) return false
    const c = checkinsToday.find(c => c.group_id === g.id)
    return !c || c.status !== 'done'
  }).length

  const vigilWatchedCount = vigilGroups.filter(g => vigilWatchedIds.has(g.id)).length
  const hasAcctGroups = allGroups.length > 0

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3.5">
          <Wheat className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="font-serif text-base font-black tracking-wide bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            麦穗喜乐
          </span>
          <LocalDateChip className="ml-auto text-xs text-stone-400" />
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-md px-5 pt-7 pb-32">

        {/* Greeting */}
        <div className="mb-6">
          <TimeGreeting name={firstName} />
          <h1 className="mt-1 text-2xl font-bold text-stone-900 tracking-wide">
            {todayAlignment ? '今日已祷告 ✓' : '愿你今日平安'}
          </h1>
          {streak >= 2 && (
            <p className="mt-1 text-sm text-amber-600 font-medium">
              🔥 连续同行 {streak} 天
            </p>
          )}
          {todayAlignment && streak < 2 && (
            <p className="mt-1 text-sm text-stone-400">
              今日心境：{todayAlignment.status_tag} · 记录已安全交托
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">

          {/* ── Card 1: 内室记录 ───────────────────────── */}
          <Link href="/daily" className="group block">
            <div className="relative overflow-hidden rounded-2xl border border-stone-100/85 bg-white/90 p-5
                            shadow-md shadow-amber-900/5 backdrop-blur-md
                            hover:shadow-lg hover:border-amber-200/60 transition-all duration-300 active:scale-[0.98]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
                    🌾
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider leading-none mb-0.5">今日记录</p>
                    <p className="text-base font-bold text-stone-900">内室记录</p>
                    <p className="text-sm text-stone-500 mt-1 leading-snug">
                      {todayAlignment
                        ? `今日心境：${todayAlignment.status_tag}`
                        : '选择今日心境，在主面前敞开心扉。'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-amber-400 transition-colors shrink-0 mt-1" />
              </div>

              <div className="mt-3.5 flex items-center gap-2">
                {todayAlignment ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    今日已完成
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-3 py-1 text-xs font-medium text-stone-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-stone-300 animate-pulse" />
                    等待今日记录
                  </span>
                )}
                {streak >= 2 && (
                  <span className="text-xs text-amber-500 font-medium">
                    🔥 {streak}天
                  </span>
                )}
              </div>

              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/5 via-transparent to-transparent" />
            </div>
          </Link>

          {/* ── Card 2: 麦穗团契 ───────────────────────── */}
          <Link href="/fellowship" className="group block">
            <div className="relative overflow-hidden rounded-2xl border border-stone-100/85 bg-white/90 p-5
                            shadow-md shadow-amber-900/5 backdrop-blur-md
                            hover:shadow-lg hover:border-stone-200 transition-all duration-300 active:scale-[0.98]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-xl">
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider leading-none mb-0.5">共同体</p>
                    <p className="text-base font-bold text-stone-900">麦穗团契</p>
                    <p className="text-sm text-stone-500 mt-1 leading-snug">
                      查看弟兄姐妹的心境，在团体中彼此关怀。
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0 mt-1" />
              </div>

              {(sessionActive || prayerCount > 0) && (
                <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                  {sessionActive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      聚会进行中
                    </span>
                  )}
                  {prayerCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
                      🙏 {prayerCount} 条代祷
                    </span>
                  )}
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-stone-400/4 via-transparent to-transparent" />
            </div>
          </Link>

          {/* ── Card 3: 同行今日 (only if has groups) ──── */}
          {hasAcctGroups && (
            <Link href="/accountability" className="group block">
              <div className="rounded-2xl border border-stone-100/85 bg-white/90 p-5
                              shadow-md shadow-amber-900/5
                              hover:shadow-lg hover:border-stone-200 transition-all duration-300 active:scale-[0.98]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-xl">
                      🤝
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider leading-none mb-0.5">同行小组</p>
                      <p className="text-base font-bold text-stone-900">今日同行</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0 mt-1" />
                </div>

                <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                  {/* Daily groups status */}
                  {dailyGroups.length > 0 && (
                    pendingDailyCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        {pendingDailyCount} 个小组待打卡
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        日常同行今日完成
                      </span>
                    )
                  )}

                  {/* Vigil groups status */}
                  {vigilGroups.length > 0 && (
                    vigilWatchedCount < vigilGroups.length ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                        🕊️ {vigilGroups.length} 个守望相助
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                        🕊️ 今日已守望
                      </span>
                    )
                  )}
                </div>
              </div>
            </Link>
          )}

          {/* ── 今日经文 ────────────────────────────────── */}
          <div className="rounded-2xl border border-amber-100/60 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-5">
            <div className="flex items-start gap-3">
              <BookOpen className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1.5">今日经文</p>
                <p className="text-sm text-stone-700 leading-relaxed italic">
                  &ldquo;{scripture.verse}&rdquo;
                </p>
                <p className="mt-2 text-xs text-stone-400">— {scripture.ref}</p>
              </div>
            </div>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
