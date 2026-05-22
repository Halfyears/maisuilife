/**
 * PATCH /api/church/scripture
 * Body: { verse: string, ref: string }
 * Auth: church_admin or super_admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role ?? ''
  if (!['super_admin', 'church_admin'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const verse = typeof body.verse === 'string' ? body.verse.trim() : ''
  const ref   = typeof body.ref   === 'string' ? body.ref.trim()   : ''
  if (!verse || !ref) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  const manual_date = new Date().toISOString().slice(0, 10)
  const { error } = await db
    .from('system_configs')
    .upsert(
      { key: 'daily_scripture', value: { verse, ref, manual_date }, updated_by: user.id },
      { onConflict: 'key' },
    )

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
