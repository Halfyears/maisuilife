import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { user_id } = body
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (user_id === user.id) return NextResponse.json({ error: 'cannot_delete_self' }, { status: 403 })

  const { data: target } = await db.from('users').select('role').eq('id', user_id).single()
  if (target?.role === 'super_admin') {
    return NextResponse.json({ error: 'cannot_delete_super_admin' }, { status: 403 })
  }

  await db.auth.admin.deleteUser(user_id)
  return NextResponse.json({ ok: true })
}
