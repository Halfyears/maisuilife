import webpush from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured) return
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@maisui-joy.app'
  if (!publicKey || !privateKey) throw new Error('VAPID keys not configured')
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushSubscriptionRecord {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  sub: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string }
): Promise<{ ok: boolean; expired?: boolean }> {
  ensureConfigured()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 86400 }
    )
    return { ok: true }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    // 404 / 410 = subscription expired
    if (statusCode === 404 || statusCode === 410) return { ok: false, expired: true }
    throw err
  }
}
