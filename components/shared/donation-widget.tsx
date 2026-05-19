import { createAdminClient } from '@/lib/supabase/server'
import { Heart } from 'lucide-react'

const PAYMENT_LABELS: Record<string, string> = {
  wechat_pay: '微信支付',
  alipay:     '支付宝',
  paypal:     'PayPal',
  venmo:      'Venmo',
  zelle:      'Zelle',
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

    const title    = typeof don.title === 'string'       ? don.title       : '感恩奉献'
    const desc     = typeof don.description === 'string' ? don.description : ''
    const currency = typeof don.currency === 'string'    ? don.currency    : 'USD'
    const amounts  = Array.isArray(don.amounts)
      ? (don.amounts as number[]).filter(n => typeof n === 'number' && n > 0)
      : []

    const btnLabel  = pay && typeof pay.label === 'string' && pay.label ? pay.label : '前往奉献'
    const payLinks  = pay
      ? Object.entries(PAYMENT_LABELS)
          .filter(([k]) => pay[k] && typeof pay[k] === 'string' && (pay[k] as string).trim())
          .map(([k, label]) => ({ label, href: (pay[k] as string).trim() }))
      : []

    return (
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/50 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-stone-800">{title}</p>
        </div>

        {desc && (
          <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>
        )}

        {amounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {amounts.map(a => (
              <span key={a}
                className="rounded-full border border-amber-200 bg-white px-3 py-1
                           text-xs font-semibold text-amber-700">
                {currency} {a}
              </span>
            ))}
          </div>
        )}

        {payLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {payLinks.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white
                           px-3 py-2 text-xs font-bold text-amber-700
                           hover:bg-amber-50 active:scale-[0.98] transition-all">
                {label}
              </a>
            ))}
          </div>
        )}

        {payLinks.length === 0 && amounts.length === 0 && (
          <p className="text-xs text-stone-400">奉献方式配置中…</p>
        )}

        {payLinks.length === 0 && amounts.length > 0 && (
          <p className="text-xs text-stone-400">请联系管理员获取奉献方式</p>
        )}
      </div>
    )
  } catch {
    return null
  }
}
