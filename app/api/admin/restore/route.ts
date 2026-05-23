/**
 * PATCH /api/admin/restore — 超管恢复软删除记录
 * body: { type: 'church' | 'fellowship' | 'group', id: string }
 */
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
  const { type, id } = body as { type: string; id: string }
  if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 })

  let error: unknown = null

  if (type === 'church') {
    const res = await db
      .from('churches')
      .update({ deleted_at: null, status: 'active' })
      .eq('id', id)
      .not('deleted_at', 'is', null)
    error = res.error
  } else if (type === 'fellowship') {
    const res = await db
      .from('fellowships')
      .update({ deleted_at: null, status: 'approved' })
      .eq('id', id)
      .not('deleted_at', 'is', null)
    error = res.error
  } else if (type === 'group') {
    const res = await db
      .from('accountability_groups')
      .update({ deleted_at: null, status: 'active' })
      .eq('id', id)
      .not('deleted_at', 'is', null)
    error = res.error
  } else {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
