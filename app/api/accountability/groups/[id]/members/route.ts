import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** GET /api/accountability/groups/[id]/members
 *  返回小组活跃成员列表（仅召集人或超管可查看完整列表）
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db      = createAdminClient()
  const groupId = params.id

  // 验证权限：必须是成员或超管
  const [groupRes, callerRes] = await Promise.all([
    db.from('accountability_groups').select('organizer_id').eq('id', groupId).single(),
    db.from('users').select('role').eq('id', user.id).single(),
  ])

  if (!groupRes.data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isAdmin     = ['church_admin', 'super_admin'].includes(callerRes.data?.role ?? '')
  const isOrganizer = groupRes.data.organizer_id === user.id

  if (!isOrganizer && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: members, error } = await db
    .from('accountability_group_members')
    .select('user_id, display_name, status')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('display_name')

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ members: members ?? [] })
}
