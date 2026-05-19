import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_CHANNELS = ['zelle','venmo','paypal','wechat_pay','alipay'] as const

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const channel  = typeof body.channel  === 'string' ? body.channel  : ''
  const amount   = typeof body.amount   === 'number' ? body.amount   : parseFloat(body.amount)
  const currency = typeof body.currency === 'string' ? body.currency : 'USD'
  const memo     = typeof body.memo     === 'string' ? body.memo.slice(0, 300) : null

  if (!ALLOWED_CHANNELS.includes(channel as typeof ALLOWED_CHANNELS[number]))
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })

  if (!amount || amount <= 0 || !isFinite(amount))
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })

  // Rate-limit: no more than 3 pending proofs per user
  const db = createAdminClient()
  const { count } = await db
    .from('payment_proofs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending_review')

  if ((count ?? 0) >= 3)
    return NextResponse.json({ error: 'too_many_pending' }, { status: 429 })

  const { data, error } = await db
    .from('payment_proofs')
    .insert({ user_id: user.id, channel, amount, currency, user_memo: memo })
    .select('id')
    .single()

  if (error) {
    console.error('[payment/submit-proof]', error.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
