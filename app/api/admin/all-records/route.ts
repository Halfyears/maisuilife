/**
 * GET /api/admin/all-records — 超管查询所有团契与同行小组（含成员数）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [fellowshipsRes, fellowshipMembersRes, groupsRes, groupMembersRes] = await Promise.all([
    db.from('fellowships')
      .select('id, name, status, invite_code, leader_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('fellowship_members').select('fellowship_id'),
    db.from('accountability_groups')
      .select('id, name, group_type, status, organizer_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('accountability_group_members').select('group_id'),
  ])

  // 计算各团契成员数
  const fmCount: Record<string, number> = {}
  for (const row of (fellowshipMembersRes.data ?? [])) {
    fmCount[row.fellowship_id] = (fmCount[row.fellowship_id] ?? 0) + 1
  }

  // 计算各小组成员数
  const gmCount: Record<string, number> = {}
  for (const row of (groupMembersRes.data ?? [])) {
    gmCount[row.group_id] = (gmCount[row.group_id] ?? 0) + 1
  }

  const fellowships = (fellowshipsRes.data ?? []).map(f => ({
    ...f,
    member_count: fmCount[f.id] ?? 0,
  }))
  const groups = (groupsRes.data ?? []).map(g => ({
    ...g,
    member_count: gmCount[g.id] ?? 0,
  }))

  return NextResponse.json({ fellowships, groups })
}
