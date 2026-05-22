export type Freq = 'daily' | 'weekly' | 'monthly' | 'realtime'

export interface NotifItem {
  id:      string
  label:   string
  enabled: boolean
  time:    string   // 'HH:MM' or '' for realtime
  freq:    Freq
}

export const BUILTIN_IDS = new Set(['morning', 'checkin', 'vigil', 'sunday', 'monthly'])

export const DEFAULT_ITEMS: NotifItem[] = [
  { id: 'morning', label: '晨间内室', enabled: true, time: '07:00', freq: 'daily'    },
  { id: 'checkin', label: '同行打卡', enabled: true, time: '20:00', freq: 'daily'    },
  { id: 'vigil',   label: '守望消息', enabled: true, time: '',      freq: 'realtime' },
  { id: 'sunday',  label: '主日报告', enabled: true, time: '09:00', freq: 'weekly'   },
  { id: 'monthly', label: '月度报告', enabled: true, time: '08:00', freq: 'monthly'  },
]

/** Normalize legacy boolean-map or empty-object format → array */
export function normalizeLegacy(raw: unknown): NotifItem[] {
  if (
    Array.isArray(raw) && raw.length > 0 &&
    typeof raw[0] === 'object' && raw[0] !== null && 'id' in (raw[0] as object)
  ) {
    return raw as NotifItem[]
  }
  return DEFAULT_ITEMS
}
