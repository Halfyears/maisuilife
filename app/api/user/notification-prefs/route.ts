import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { BUILTIN_IDS, DEFAULT_ITEMS, normalizeLegacy } from '@/lib/notification-prefs'

export const runtime = 'nodejs'

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
