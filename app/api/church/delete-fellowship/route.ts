import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
  if (!caller || !['church_admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { fellowship_id } = body
  if (!fellowship_id) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

  await db.from('fellowships').delete().eq('id', fellowship_id)
  return NextResponse.json({ ok: true })
}
