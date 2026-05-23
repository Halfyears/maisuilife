/**
 * GET /api/admin/deleted-records — 超管查询所有软删除记录
 * 返回已删除的教会、团契、同行小组
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

  const [churchesRes, fellowshipsRes, groupsRes] = await Promise.all([
    db.from('churches')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(50),
    db.from('fellowships')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(50),
    db.from('accountability_groups')
      .select('id, name, group_type, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({
    churches:     churchesRes.data    ?? [],
    fellowships:  fellowshipsRes.data ?? [],
    groups:       groupsRes.data      ?? [],
  })
}
