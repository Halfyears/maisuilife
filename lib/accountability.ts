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

const CATEGORY_LABEL: Record<string, string> = {
  // Daily track
  prayer:           '🙏 祷告',
  bible_reading:    '📖 读经',
  morning_prayer:   '🌅 晨祷',
  gathering:        '⛪ 聚会',
  hiking:           '🌲 徒步',
  travel:           '✈️ 旅行',
  meditation:       '🤍 静修',
  // Vigil track
  vigil_illness:    '🕯️ 重病陪伴',
  vigil_icu:        '🕯️ ICU守护',
  vigil_career:     '🌿 事业重建',
  vigil_life_change:'🌿 重大变故',
  vigil_family:     '🌿 家庭变故',
  vigil_grief:      '🕯️ 丧亲陪伴',
  vigil_loss:       '🕯️ 生命失去',
}

export function goalCategoryLabel(cat: string): string {
  return CATEGORY_LABEL[cat] ?? `✨ ${cat}`
}

export const DAILY_PRESET_CATEGORIES = [
  { value: 'prayer',         label: '🙏 祷告'  },
  { value: 'bible_reading',  label: '📖 读经'  },
  { value: 'morning_prayer', label: '🌅 晨祷'  },
  { value: 'gathering',      label: '⛪ 聚会'  },
  { value: 'hiking',         label: '🌲 徒步'  },
  { value: 'travel',         label: '✈️ 旅行'  },
  { value: 'meditation',     label: '🤍 静修'  },
] as const

export const VIGIL_PRESET_CATEGORIES = [
  { value: 'vigil_illness',     label: '🕯️ 重病陪伴' },
  { value: 'vigil_icu',         label: '🕯️ ICU守护'  },
  { value: 'vigil_career',      label: '🌿 事业重建' },
  { value: 'vigil_life_change', label: '🌿 重大变故' },
  { value: 'vigil_family',      label: '🌿 家庭变故' },
  { value: 'vigil_grief',       label: '🕯️ 丧亲陪伴' },
  { value: 'vigil_loss',        label: '🕯️ 生命失去' },
] as const

const DAILY_PRESET_VALUES: Set<string> = new Set(DAILY_PRESET_CATEGORIES.map(c => c.value))
const VIGIL_PRESET_VALUES: Set<string> = new Set(VIGIL_PRESET_CATEGORIES.map(c => c.value))
export function isDailyPreset(cat: string) { return DAILY_PRESET_VALUES.has(cat) }
export function isVigilPreset(cat: string) { return VIGIL_PRESET_VALUES.has(cat) }

// Kept for backward compat
export const GOAL_CATEGORY_LABEL: Record<string, string> = {
  prayer:        '🙏 祷告',
  bible_reading: '📖 读经',
  custom:        '✨ 自定义',
}
