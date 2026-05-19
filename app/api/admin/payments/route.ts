import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('users').select('role').eq('id', user.id).single()
  return p?.role === 'super_admin' || p?.role === 'church_admin' ? user : null
}

// GET: list pending proofs
export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending_review'

  const db = createAdminClient()
  const { data, error } = await db
    .from('payment_proofs')
    .select('id, user_id, channel, amount, currency, user_memo, status, admin_note, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ proofs: data })
}

// PATCH: approve or reject
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const id     = typeof body.id     === 'string' ? body.id     : ''
  const action = typeof body.action === 'string' ? body.action : ''
  const note   = typeof body.note   === 'string' ? body.note.slice(0, 300) : null

  if (!id || !['approved','rejected'].includes(action))
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('payment_proofs')
    .update({ status: action, admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ success: true })
}
