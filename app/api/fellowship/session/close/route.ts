import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const session_id = typeof body.session_id === 'string' ? body.session_id : ''
  if (!session_id) return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })

  const db = createAdminClient()

  const { data: session } = await db
    .from('fellowship_sessions')
    .select('id, organizer_id, fellowship_id')
    .eq('id', session_id)
    .single()
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: prof } = await db.from('users').select('role').eq('id', user.id).single()
  const isOrg  = session.organizer_id === user.id
  const isPriv = ['church_admin', 'super_admin'].includes(prof?.role ?? '')
  if (!isOrg && !isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await db.from('fellowship_sessions').update({
    state: 'closed',
    closed_at: new Date().toISOString(),
  }).eq('id', session_id)

  return NextResponse.json({ ok: true })
}
