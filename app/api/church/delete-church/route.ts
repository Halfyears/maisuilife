/**
 * DELETE /api/church/delete-church — 软删除教会（super_admin 专用）
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
  if (caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { church_id } = body
  if (!church_id) return NextResponse.json({ error: 'church_id required' }, { status: 400 })

  // 软删除：记录删除时间，不物理清除
  const { error } = await db
    .from('churches')
    .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', church_id)
    .is('deleted_at', null) // 防止重复删除

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
