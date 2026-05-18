import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateGrowthReport } from '@/lib/ai/growth-report'
import { sendPushNotification, type PushSubscriptionRecord } from '@/lib/push'

export const runtime = 'nodejs'
export const maxDuration = 60

// Runs on the 1st of each month at 9:30 AM LA time (UTC 17:30 in winter / 16:30 in summer)
// vercel.json schedule: "30 17 1 * *"
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const now = new Date()
  const laFmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d)
  const today = laFmt(now)
  const monthAgo = laFmt(new Date(now.getTime() - 31 * 86_400_000))

  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(subs.map(s => s.user_id))]

  const [alignRes, prayerRes, checkinRes, fellowshipRes] = await Promise.all([
    db.from('daily_alignments')
      .select('user_id, status_tag')
      .in('user_id', userIds)
      .gte('date', monthAgo)
      .lte('date', today),
    db.from('prayer_requests')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', `${monthAgo}T00:00:00Z`),
    db.from('accountability_checkins')
      .select('user_id')
      .in('user_id', userIds)
      .gte('checkin_date', monthAgo)
      .lte('checkin_date', today),
    db.from('fellowship_posts')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', `${monthAgo}T00:00:00Z`),
  ])

  let sent = 0

  for (const userId of userIds) {
    const userSubs = subs.filter(s => s.user_id === userId) as PushSubscriptionRecord[]

    const dailyCount      = alignRes.data?.filter(r => r.user_id === userId).length ?? 0
    const prayerCount     = prayerRes.data?.filter(r => r.user_id === userId).length ?? 0
    const checkinCount    = checkinRes.data?.filter(r => r.user_id === userId).length ?? 0
    const fellowshipCount = fellowshipRes.data?.filter(r => r.user_id === userId).length ?? 0
    const moods = alignRes.data
      ?.filter(r => r.user_id === userId && r.status_tag)
      .map(r => r.status_tag as string) ?? []
    const topMoods = [...new Set(moods)].slice(0, 5)

    let report
    try {
      report = await generateGrowthReport({
        type: 'monthly',
        stats: { dailyCount, prayerCount, checkinCount, fellowshipCount, topMoods, dateRange: `${monthAgo} 至 ${today}` },
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
