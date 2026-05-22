import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const PrefsSchema = z.object({
  prefs: z.object({
    morning:  z.boolean(),
    checkin:  z.boolean(),
    vigil:    z.boolean(),
    sunday:   z.boolean(),
    monthly:  z.boolean(),
  }),
})

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = PrefsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from('users')
    .update({ notification_prefs: parsed.data.prefs } as never)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from('users')
    .select('notification_prefs')
    .eq('id', user.id)
    .single()

  const prefs = (data as { notification_prefs?: Record<string, boolean> } | null)?.notification_prefs ?? {}
  return NextResponse.json({ prefs })
}
