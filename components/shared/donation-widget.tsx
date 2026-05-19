import { createAdminClient } from '@/lib/supabase/server'
import { DonationInteractive, type PaymentConfig } from './donation-interactive'

interface Appeal {
  title:  string
  body:   string
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

    const appeals: Appeal[] = Array.isArray(don.appeals) ? (don.appeals as Appeal[]) : []
    const appeal =
      appeals.find(a => Array.isArray(a.pages) && a.pages.includes(pageKey)) ??
      appeals[0] ??
      null

    function str(key: string) {
      return pay && typeof pay[key] === 'string' ? (pay[key] as string).trim() : undefined
    }

    const payment: PaymentConfig = {
      zelle_account:  str('zelle_account')  || str('zelle'),
      venmo_username: str('venmo_username') || str('venmo'),
      paypal_me:      str('paypal_me')      || str('paypal'),
      wechat_qr_url:  str('wechat_qr_url') || str('wechat_pay'),
      alipay_qr_url:  str('alipay_qr_url') || str('alipay'),
    }

    return (
      <DonationInteractive
        appeal={appeal ? { title: appeal.title, body: appeal.body } : null}
        amounts={amounts}
        currency={currency}
        payment={payment}
      />
    )
  } catch {
    return null
  }
}
