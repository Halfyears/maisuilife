import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const fellowship_id    = typeof body.fellowship_id   === 'string' ? body.fellowship_id : ''
  const expected_count   = typeof body.expected_count  === 'number' ? body.expected_count : 0
  if (!fellowship_id) return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })
  if (expected_count < 1 || expected_count > 200)
    return NextResponse.json({ error: 'invalid_expected_count' }, { status: 400 })

  const db = createAdminClient()

  // Verify caller is leader or privileged admin
  const { data: profile } = await db
    .from('users').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!['group_leader','church_admin','super_admin'].includes(role))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (role === 'group_leader') {
    const { data: f } = await db
      .from('fellowships').select('id').eq('id', fellowship_id).eq('leader_id', user.id).maybeSingle()
    if (!f) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Close any existing open sessions for this fellowship
  await db.from('fellowship_sessions')
    .update({ state: 'closed', closed_at: new Date().toISOString() })
    .eq('fellowship_id', fellowship_id)
    .in('state', ['checkin','harvest'])

  // Create new session
  const { data: session, error } = await db
    .from('fellowship_sessions')
    .insert({ fellowship_id, organizer_id: user.id, expected_count, state: 'checkin' })
    .select('id, state, expected_count, checkin_count')
    .single()

  if (error) {
    console.error('[session/start]', error.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ session })
}
