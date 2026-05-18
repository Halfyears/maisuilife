import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateGrowthReport } from '@/lib/ai/growth-report'
import { sendPushNotification, type PushSubscriptionRecord } from '@/lib/push'

export const runtime = 'nodejs'
export const maxDuration = 60

// Runs every Sunday at 9:00 AM LA time (UTC 17:00 in winter / 16:00 in summer)
// vercel.json schedule: "0 17 * * 0"
export async function GET(req: Request) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // LA date range for the past 7 days
  const now = new Date()
  const laFmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d)
  const today = laFmt(now)
  const weekAgo = laFmt(new Date(now.getTime() - 7 * 86_400_000))

  // Fetch all users who have push subscriptions
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(subs.map(s => s.user_id))]

  // Batch-fetch stats for all users
  const [alignRes, prayerRes, checkinRes, fellowshipRes] = await Promise.all([
    db.from('daily_alignments')
      .select('user_id, status_tag')
      .in('user_id', userIds)
      .gte('date', weekAgo)
      .lte('date', today),
    db.from('prayer_requests')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', `${weekAgo}T00:00:00Z`),
    db.from('accountability_checkins')
      .select('user_id')
      .in('user_id', userIds)
      .gte('checkin_date', weekAgo)
      .lte('checkin_date', today),
    db.from('fellowship_posts')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', `${weekAgo}T00:00:00Z`),
  ])

  let sent = 0

  for (const userId of userIds) {
    const userSubs = subs.filter(s => s.user_id === userId) as PushSubscriptionRecord[]

    const dailyCount     = alignRes.data?.filter(r => r.user_id === userId).length ?? 0
    const prayerCount    = prayerRes.data?.filter(r => r.user_id === userId).length ?? 0
    const checkinCount   = checkinRes.data?.filter(r => r.user_id === userId).length ?? 0
    const fellowshipCount = fellowshipRes.data?.filter(r => r.user_id === userId).length ?? 0
    const moods = alignRes.data
      ?.filter(r => r.user_id === userId && r.status_tag)
      .map(r => r.status_tag as string) ?? []
    const topMoods = [...new Set(moods)].slice(0, 3)

    let report
    try {
      report = await generateGrowthReport({
        type: 'weekly',
        stats: { dailyCount, prayerCount, checkinCount, fellowshipCount, topMoods, dateRange: `${weekAgo} 至 ${today}` },
      })
    } catch {
      continue
    }

    const payload = {
      title: `🌾 ${report.greeting}`,
      body: report.encouragement,
      url: '/settings',
    }

    for (const sub of userSubs) {
      const result = await sendPushNotification(sub, payload)
      if (result.ok) sent++
      if (result.expired) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return NextResponse.json({ sent })
}
