import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/push'

export const runtime = 'nodejs'

/** DELETE /api/accountability/groups/[id]/members/[userId]
 *  召集人（或超管）移除指定成员
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db                      = createAdminClient()
  const { id: groupId, userId: targetId } = params

  // 获取小组信息
  const { data: group } = await db
    .from('accountability_groups')
    .select('name, organizer_id')
    .eq('id', groupId)
    .single()

  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // 权限：仅召集人或超管可操作
  const { data: callerProfile } = await db
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  const isAdmin = ['church_admin', 'super_admin'].includes(callerProfile?.role ?? '')
  if (group.organizer_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 不可移除召集人本人
  if (targetId === group.organizer_id) {
    return NextResponse.json({ error: 'cannot_remove_organizer' }, { status: 400 })
  }

  // 确认目标成员存在且活跃
  const { data: targetMember } = await db
    .from('accountability_group_members')
    .select('display_name, status')
    .eq('group_id', groupId)
    .eq('user_id', targetId)
    .maybeSingle()

  if (!targetMember)                     return NextResponse.json({ error: 'member_not_found' }, { status: 404 })
  if (targetMember.status !== 'active')  return NextResponse.json({ error: 'already_removed'  }, { status: 409 })

  // 软删除：标记已移除
  const { error: updateErr } = await db
    .from('accountability_group_members')
    .update({ status: 'removed', removed_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', targetId)

  if (updateErr) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // 推送通知被移除成员（尽力而为）
  try {
    const { data: sub } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', targetId)
      .maybeSingle()

    if (sub) {
      await sendPushNotification(sub, {
        title: '你已离开小组',
        body:  `召集人「${callerProfile?.display_name ?? ''}」已将你从小组「${group.name}」中移除`,
        url:   '/accountability',
      })
    }
  } catch { /* 通知失败不影响主流程 */ }

  return NextResponse.json({ ok: true })
}
