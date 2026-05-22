import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
  if (!caller || !['church_admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { user_id, is_active } = body
  if (!user_id || typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }
  if (user_id === user.id) {
    return NextResponse.json({ error: 'cannot_change_own_status' }, { status: 403 })
  }

  const { data: target } = await db.from('users').select('role').eq('id', user_id).single()
  if (caller.role === 'church_admin' && target && ['super_admin', 'church_admin'].includes(target.role)) {
    return NextResponse.json({ error: 'permission_denied' }, { status: 403 })
  }

  await db.from('users').update({ is_active }).eq('id', user_id)
  return NextResponse.json({ ok: true })
}
