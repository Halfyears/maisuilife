import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification, type PushSubscriptionRecord } from '@/lib/push'

export const runtime    = 'nodejs'
export const maxDuration = 30

// Runs every day at 09:00 CST (UTC 01:00)
// vercel.json schedule: "0 1 * * *"
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // CST date (UTC+8)
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)

  // Fetch all push subscriptions
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(subs.map(s => s.user_id))]

  // Find users who have NOT done today's 内室记录
  const { data: done } = await db
    .from('daily_alignments')
    .select('user_id')
    .in('user_id', userIds)
    .eq('date', today)

  const doneSet = new Set((done ?? []).map(r => r.user_id))
  const pendingIds = userIds.filter(id => !doneSet.has(id))

  if (pendingIds.length === 0) return NextResponse.json({ sent: 0, note: 'all done' })

  const MESSAGES = [
    { title: '🌾 早安，今日内室', body: '在新的一天与祂相遇，把今日心声放在祂面前。' },
    { title: '☀️ 内室时刻到了', body: '愿今日的祷告成为你一天的锚，祝平安喜乐。' },
    { title: '🌿 开始今日内室', body: '先把心交给祂，再开始这一天。今日心声等你记录。' },
  ]

  let sent = 0

  for (const userId of pendingIds) {
    const userSubs = subs.filter(s => s.user_id === userId) as PushSubscriptionRecord[]
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

    for (const sub of userSubs) {
      const result = await sendPushNotification(sub, { ...msg, url: '/daily' })
      if (result.ok) sent++
      if (result.expired) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return NextResponse.json({ sent, pending: pendingIds.length })
}
