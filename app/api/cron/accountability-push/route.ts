import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification, type PushSubscriptionRecord } from '@/lib/push'

export const runtime    = 'nodejs'
export const maxDuration = 30

// Runs every day at 19:00 CST (UTC 11:00)
// Reminds users who have a daily group scheduled today but haven't checked in yet.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // CST date (UTC+8) and day-of-week (1=Mon … 7=Sun)
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  const todayDow = (() => {
    const d = new Date(today + 'T00:00:00Z').getUTCDay()
    return d === 0 ? 7 : d
  })()

  // 1. Fetch all push subscriptions
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  const subRecords = subs as { user_id: string; endpoint: string; p256dh: string; auth: string }[]
  const userIds    = [...new Set(subRecords.map(s => s.user_id))]

  // 2. Fetch daily group memberships for these users
  const { data: memberships } = await db
    .from('accountability_group_members')
    .select('user_id, group_id')
    .in('user_id', userIds)

  if (!memberships || memberships.length === 0) return NextResponse.json({ sent: 0 })

  const memberRows = memberships as { user_id: string; group_id: string }[]
  const groupIds   = [...new Set(memberRows.map(m => m.group_id))]

  // 3. Get daily groups that have today scheduled (graceful if migration 021 not applied)
  let scheduledGroupIds: Set<string>
  try {
    const { data: groups } = await db
      .from('accountability_groups')
      .select('id, schedule_days_of_week')
      .in('id', groupIds)
      .eq('group_type', 'daily')

    scheduledGroupIds = new Set(
      ((groups ?? []) as { id: string; schedule_days_of_week: number[] | null }[])
        .filter(g => Array.isArray(g.schedule_days_of_week) && g.schedule_days_of_week.includes(todayDow))
        .map(g => g.id)
    )
  } catch {
    return NextResponse.json({ sent: 0, note: 'migration not applied' })
  }

  if (scheduledGroupIds.size === 0) return NextResponse.json({ sent: 0, note: 'no groups scheduled today' })

  // 4. Find user-group pairs that are scheduled today
  const scheduledPairs = memberRows.filter(m => scheduledGroupIds.has(m.group_id))
  const scheduledUserIds = [...new Set(scheduledPairs.map(m => m.user_id))]

  // 5. Find which users already have a done checkin today for any scheduled group
  const { data: checkins } = await db
    .from('accountability_checkins')
    .select('user_id, group_id')
    .in('user_id', scheduledUserIds)
    .in('group_id', [...scheduledGroupIds])
    .eq('checkin_date', today)
    .eq('status', 'done')

  const doneSet = new Set(
    ((checkins ?? []) as { user_id: string; group_id: string }[]).map(c => `${c.user_id}:${c.group_id}`)
  )

  // A user needs a reminder if they have at least one scheduled group without a done checkin
  const pendingUserIds = scheduledUserIds.filter(uid =>
    scheduledPairs
      .filter(p => p.user_id === uid)
      .some(p => !doneSet.has(`${uid}:${p.group_id}`))
  )

  if (pendingUserIds.length === 0) return NextResponse.json({ sent: 0, note: 'all checked in' })

  const MESSAGES = [
    { title: '🌿 今日同行打卡提醒', body: '在这一天接近尾声前，别忘了记录你的同行脚步。' },
    { title: '🌾 同行小组在等你', body: '今日的打卡还未完成，彼此坚守，继续同行。' },
    { title: '✅ 今日打卡未完成', body: '坚持同行，今日目标还差一步，加油！' },
  ]

  const subsByUser: Record<string, PushSubscriptionRecord[]> = {}
  for (const s of subRecords) {
    if (!subsByUser[s.user_id]) subsByUser[s.user_id] = []
    subsByUser[s.user_id].push(s)
  }

  let sent = 0
  for (const userId of pendingUserIds) {
    const userSubs = subsByUser[userId] ?? []
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
    for (const sub of userSubs) {
      const result = await sendPushNotification(sub, { ...msg, url: '/accountability' })
      if (result.ok) sent++
      if (result.expired) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return NextResponse.json({ sent, pending: pendingUserIds.length })
}
