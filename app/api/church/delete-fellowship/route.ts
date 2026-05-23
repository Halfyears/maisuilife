/**
 * DELETE /api/church/delete-fellowship — 软删除团契（church_admin / super_admin）
 * 仅设置 deleted_at，不物理删除，可由超管恢复
 */
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

  // 软删除：记录删除时间，状态标记为 deleted
  const { error } = await db
    .from('fellowships')
    .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', fellowship_id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
