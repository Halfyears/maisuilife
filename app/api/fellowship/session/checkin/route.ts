import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const fellowship_id = typeof body.fellowship_id === 'string' ? body.fellowship_id : ''
  if (!fellowship_id) return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })

  const db = createAdminClient()

  // Verify membership and get anon_label
  const { data: member } = await db
    .from('fellowship_members')
    .select('layer2_label')
    .eq('fellowship_id', fellowship_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  // Find active checkin session
  const { data: session } = await db
    .from('fellowship_sessions')
    .select('id, expected_count, checkin_count')
    .eq('fellowship_id', fellowship_id)
    .eq('state', 'checkin')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'no_active_session' }, { status: 404 })

  // Upsert check-in (idempotent)
  const anon_label = member.layer2_label || '同行者'
  const { error: ciErr } = await db
    .from('session_checkins')
    .upsert({ session_id: session.id, user_id: user.id, anon_label }, { onConflict: 'session_id,user_id' })
  if (ciErr) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // Recount checkins for accuracy (avoids race condition with simple +1)
  const { count } = await db
    .from('session_checkins')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id)
  const checkin_count = count ?? session.checkin_count + 1

  await db.from('fellowship_sessions')
    .update({ checkin_count })
    .eq('id', session.id)

  // Determine progress value for client
  const expected = session.expected_count
  let progress = 0
  if (checkin_count >= expected) {
    progress = 100
  } else if (checkin_count === expected - 1) {
    progress = 85
  } else {
    progress = Math.round((checkin_count / expected) * 85)
  }

  return NextResponse.json({ session_id: session.id, checkin_count, expected_count: expected, progress })
}
