import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const BUILTIN_IDS = new Set(['morning', 'checkin', 'vigil', 'sunday', 'monthly'])
const FREQ_VALUES = ['daily', 'weekly', 'monthly', 'realtime'] as const

const ItemSchema = z.object({
  id:      z.string().min(1).max(64),
  label:   z.string().min(1).max(20),
  enabled: z.boolean(),
  time:    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')),
  freq:    z.enum(FREQ_VALUES),
})

const PrefsSchema = z.object({
  items: z.array(ItemSchema).min(0).max(10),
})

export const DEFAULT_ITEMS = [
  { id: 'morning', label: '晨间内室', enabled: true, time: '07:00', freq: 'daily'    as const },
  { id: 'checkin', label: '同行打卡', enabled: true, time: '20:00', freq: 'daily'    as const },
  { id: 'vigil',   label: '守望消息', enabled: true, time: '',      freq: 'realtime' as const },
  { id: 'sunday',  label: '主日报告', enabled: true, time: '09:00', freq: 'weekly'   as const },
  { id: 'monthly', label: '月度报告', enabled: true, time: '08:00', freq: 'monthly'  as const },
]

// Normalize legacy boolean-map or empty-object format → array
export function normalizeLegacy(raw: unknown): typeof DEFAULT_ITEMS {
  if (Array.isArray(raw) && raw.length > 0 &&
      typeof raw[0] === 'object' && raw[0] !== null && 'id' in (raw[0] as object)) {
    return raw as typeof DEFAULT_ITEMS
  }
  return DEFAULT_ITEMS
}

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db.from('users').select('notification_prefs').eq('id', user.id).single()
  const raw = (data as { notification_prefs?: unknown } | null)?.notification_prefs
  return NextResponse.json({ items: normalizeLegacy(raw) })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = PrefsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const { items } = parsed.data

  // Built-in items cannot be deleted
  const presentBuiltins = new Set(items.filter(i => BUILTIN_IDS.has(i.id)).map(i => i.id))
  if (presentBuiltins.size < BUILTIN_IDS.size) {
    return NextResponse.json({ error: 'cannot_delete_builtin' }, { status: 400 })
  }

  // Custom items: max 5
  if (items.filter(i => !BUILTIN_IDS.has(i.id)).length > 5) {
    return NextResponse.json({ error: 'too_many_custom' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('users')
    .update({ notification_prefs: items } as never)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
