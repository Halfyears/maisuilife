import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Schema = z.object({
  church_id:    z.string().uuid(),
  contact_info: z.string().max(500),
})

const ALLOWED_ROLES = ['super_admin', 'church_admin']

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (!ALLOWED_ROLES.includes((profile as { role: string } | null)?.role ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const { church_id, contact_info } = parsed.data
  const { error } = await db.from('churches').update({ contact_info }).eq('id', church_id)
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
