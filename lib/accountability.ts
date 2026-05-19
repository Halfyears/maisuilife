import type { AccountabilityCheckin, MemberProgress } from '@/types'

// Returns Monday of the week that contains `today` (YYYY-MM-DD).
// Pure function — no timezone assumptions. Callers supply today from todayLocal().
export function getWeekStart(today: string): string {
  const d = new Date(today + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=Sun…6=Sat
  const diff = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

// Legacy aliases — kept so existing callers still compile during migration.
export function todayCSTString(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}
export function getWeekStartCST(): string {
  return getWeekStart(todayCSTString())
}

// Returns dates from week start up to today that fall on scheduled days
// scheduleDays: 1=Mon … 7=Sun
export function getScheduledDates(scheduleDays: number[], weekStart: string, today: string): string[] {
  if (!scheduleDays.length) return []
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    if (dateStr > today) break
    const specDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    if (scheduleDays.includes(specDay)) dates.push(dateStr)
  }
  return dates
}

// Count consecutive done days from today backwards
export function consecutiveDays(checkins: { checkin_date: string; status: string }[], today: string): number {
  const doneSet = new Set(checkins.filter(c => c.status === 'done').map(c => c.checkin_date))
  let count = 0
  const cursor = new Date(today + 'T00:00:00Z')
  while (count < 365) {
    if (!doneSet.has(cursor.toISOString().slice(0, 10))) break
    count++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return count
}

export function buildMemberProgress(
  members: { user_id: string; display_name: string }[],
  weekCheckins: AccountabilityCheckin[],
  histCheckins: AccountabilityCheckin[],
  scheduledDates: string[],
  today: string,
  myUserId: string,
): MemberProgress[] {
  const histByUser: Record<string, AccountabilityCheckin[]> = {}
  for (const c of histCheckins) {
    if (!histByUser[c.user_id]) histByUser[c.user_id] = []
    histByUser[c.user_id].push(c)
  }

  const progress = members.map(m => {
    const mCheckins = weekCheckins.filter(c => c.user_id === m.user_id)
    const done = mCheckins.filter(c => c.status === 'done' && scheduledDates.includes(c.checkin_date)).length
    const total = scheduledDates.length
    const rate = total > 0 ? Math.round((done / total) * 100) : 0
    const cons = consecutiveDays(histByUser[m.user_id] ?? [], today)
    const todayC = mCheckins.find(c => c.checkin_date === today) ?? null

    return {
      user_id:          m.user_id,
      user_name:        m.display_name || '同行者',
      completed:        done,
      total,
      completion_rate:  rate,
      consecutive_days: cons,
      status:           (rate === 100 ? 'perfect' : rate >= 50 ? 'on_track' : 'missing') as MemberProgress['status'],
      today_status:     todayC ? todayC.status : null,
    }
  })

  return progress.sort((a, b) =>
    b.completion_rate - a.completion_rate || b.consecutive_days - a.consecutive_days
  )
}

export const DAY_LABEL = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

const PRESET_CATEGORY_LABEL: Record<string, string> = {
  prayer:        '🙏 祷告',
  bible_reading: '📖 读经',
}

export function goalCategoryLabel(cat: string): string {
  return PRESET_CATEGORY_LABEL[cat] ?? `✨ ${cat}`
}

// Kept for backward compat
export const GOAL_CATEGORY_LABEL: Record<string, string> = {
  prayer:        '🙏 祷告',
  bible_reading: '📖 读经',
  custom:        '✨ 自定义',
}
