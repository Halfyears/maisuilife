import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { church_id, status } = body
  if (!church_id || !['active', 'ended'].includes(status)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  await db.from('churches').update({ status }).eq('id', church_id)
  return NextResponse.json({ ok: true })
}
