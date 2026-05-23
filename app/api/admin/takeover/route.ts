/**
 * POST /api/admin/takeover — 超管强制接管团契或同行小组
 * body: { type: 'fellowship' | 'group', id: string }
 * 将领袖/召集人改为当前超管用户
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role, display_name').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { type, id } = body as { type: string; id: string }
  if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 })

  if (type === 'fellowship') {
    // 将团契 leader_id 更新为超管
    const { error } = await db
      .from('fellowships')
      .update({ leader_id: user.id })
      .eq('id', id)
    if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

    // 确保超管在 fellowship_members 中
    await db.from('fellowship_members').upsert({
      fellowship_id: id,
      user_id:       user.id,
      layer2_label:  caller?.display_name ?? '管理员',
      status_tag:    'peaceful',
    }, { onConflict: 'fellowship_id,user_id', ignoreDuplicates: true })

  } else if (type === 'group') {
    // 将同行小组 organizer_id 更新为超管
    const { error } = await db
      .from('accountability_groups')
      .update({ organizer_id: user.id })
      .eq('id', id)
    if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

    // 确保超管在 accountability_group_members 中
    await db.from('accountability_group_members').upsert({
      group_id:     id,
      user_id:      user.id,
      display_name: caller?.display_name ?? '管理员',
      role:         'convener',
    }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })

  } else {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
