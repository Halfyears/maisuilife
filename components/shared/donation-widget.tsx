import { createAdminClient } from '@/lib/supabase/server'
import { DonationInteractive } from './donation-interactive'

const PAY_META: Record<string, { label: string; color: string; icon: string }> = {
  zelle:      { label: 'Zelle',    color: 'bg-[#6D1ED4]', icon: '💜' },
  venmo:      { label: 'Venmo',    color: 'bg-[#3D95CE]', icon: '💙' },
  paypal:     { label: 'PayPal',   color: 'bg-[#003087]', icon: '🔵' },
  wechat_pay: { label: '微信支付', color: 'bg-[#07C160]', icon: '💚' },
  alipay:     { label: '支付宝',   color: 'bg-[#1677FF]', icon: '🔷' },
}

interface Appeal {
  title: string
  body:  string
  pages?: string[]
}

interface Props {
  pageKey: string
}

export async function DonationWidget({ pageKey }: Props) {
  try {
    const db = createAdminClient()
    const [donRes, payRes] = await Promise.all([
      db.from('system_configs').select('value').eq('key', 'donation_settings').maybeSingle(),
      db.from('system_configs').select('value').eq('key', 'payment_links').maybeSingle(),
    ])

    const don = donRes.data?.value as Record<string, unknown> | null
    const pay = payRes.data?.value as Record<string, unknown> | null

    if (!don) return null

    const showOn = Array.isArray(don.show_on) ? (don.show_on as string[]) : []
    if (!showOn.includes(pageKey)) return null

    const currency = typeof don.currency === 'string' ? don.currency : 'USD'
    const amounts  = Array.isArray(don.amounts)
      ? (don.amounts as number[]).filter(n => typeof n === 'number' && n > 0)
      : [10, 20, 50]

    // Find the appeal for this page
    const appeals: Appeal[] = Array.isArray(don.appeals)
      ? (don.appeals as Appeal[])
      : []
    const appeal =
      appeals.find(a => Array.isArray(a.pages) && a.pages.includes(pageKey)) ??
      appeals[0] ??
      null

    // Build payment links
    const payLinks = pay
      ? Object.entries(PAY_META)
          .filter(([k]) => pay[k] && typeof pay[k] === 'string' && (pay[k] as string).trim())
          .map(([k, meta]) => ({ key: k, ...meta, href: (pay[k] as string).trim() }))
      : []

    return (
      <DonationInteractive
        appeal={appeal ? { title: appeal.title, body: appeal.body } : null}
        amounts={amounts}
        currency={currency}
        payLinks={payLinks}
      />
    )
  } catch {
    return null
  }
}
