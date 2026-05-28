import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/push'

export const runtime = 'nodejs'

/** DELETE /api/accountability/groups/[id]/members/self
 *  成员主动退出小组（召集人不可退，需先结束小组）
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db      = createAdminClient()
  const groupId = params.id

  // 确认当前成员资格
  const { data: memberRow } = await db
    .from('accountability_group_members')
    .select('display_name, status')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberRow)                     return NextResponse.json({ error: 'not_member'    }, { status: 403 })
  if (memberRow.status !== 'active')  return NextResponse.json({ error: 'already_left'  }, { status: 409 })

  // 获取小组信息（用于通知召集人）
  const { data: group } = await db
    .from('accountability_groups')
    .select('name, organizer_id')
    .eq('id', groupId)
    .single()

  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // 召集人不可自行退出，需使用「结束小组」
  if (group.organizer_id === user.id) {
    return NextResponse.json({ error: 'organizer_cannot_leave' }, { status: 400 })
  }

  // 软删除：标记已退出
  const { error: updateErr } = await db
    .from('accountability_group_members')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', user.id)

  if (updateErr) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // 推送通知召集人（尽力而为，不阻断主流程）
  try {
    const { data: sub } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', group.organizer_id)
      .maybeSingle()

    if (sub) {
      await sendPushNotification(sub, {
        title: '小组成员离开',
        body:  `${memberRow.display_name} 已退出小组「${group.name}」`,
        url:   `/accountability/${groupId}`,
      })
    }
  } catch { /* 通知失败不影响主流程 */ }

  return NextResponse.json({ ok: true })
}
