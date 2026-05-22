/**
 * PATCH /api/user/profile — 更新当前用户的显示名
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { display_name } = await req.json()
  const name = (display_name ?? '').trim().slice(0, 30)
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from('users')
    .update({ display_name: name })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // 同步历史代祷记录的显示名（非匿名条目）
  await db
    .from('prayer_requests')
    .update({ display_name: name })
    .eq('user_id', user.id)
    .eq('is_anonymous', false)

  // 同步团契成员的 layer2_label（用于团契页面显示名）
  await db
    .from('fellowship_members')
    .update({ layer2_label: name })
    .eq('user_id', user.id)

  // 同步同行小组成员显示名
  await db
    .from('accountability_group_members')
    .update({ display_name: name })
    .eq('user_id', user.id)

  // 同步守望祷告记录的显示名（历史记录同步，非匿名）
  await db
    .from('accountability_vigil_prayers')
    .update({ display_name: name })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, display_name: name })
}
