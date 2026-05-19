import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/fellowship/session/current?fellowship_id=xxx
// Returns the active (checkin|harvest) session for the fellowship, plus checkin list.
// Used by projector for polling (every 2s) and by member page for banner state.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fellowship_id = req.nextUrl.searchParams.get('fellowship_id') ?? ''
  if (!fellowship_id) return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })

  const db = createAdminClient()

  // Privileged roles (church_admin / super_admin) bypass membership check
  const { data: prof } = await db.from('users').select('role').eq('id', user.id).single()
  const isPrivileged = ['church_admin', 'super_admin'].includes(prof?.role ?? '')

  if (!isPrivileged) {
    // Allow: fellowship leader OR a member of the fellowship
    const [{ data: member }, { data: asLeader }] = await Promise.all([
      db.from('fellowship_members')
        .select('user_id')
        .eq('fellowship_id', fellowship_id)
        .eq('user_id', user.id)
        .maybeSingle(),
      db.from('fellowships')
        .select('id')
        .eq('id', fellowship_id)
        .eq('leader_id', user.id)
        .maybeSingle(),
    ])
    if (!member && !asLeader) return NextResponse.json({ error: 'not_member' }, { status: 403 })
  }

  // Get current open session
  const { data: session } = await db
    .from('fellowship_sessions')
    .select('id, state, expected_count, checkin_count, wheat_total, scripture_cards, amen_count, started_at, harvested_at')
    .eq('fellowship_id', fellowship_id)
    .in('state', ['checkin', 'harvest'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return NextResponse.json({ session: null })

  // Get checkin list (anon labels only) for candle matrix
  const { data: checkins } = await db
    .from('session_checkins')
    .select('anon_label, checked_in_at')
    .eq('session_id', session.id)
    .order('checked_in_at', { ascending: true })

  // Has current user checked in?
  const i_checked_in = (checkins ?? []).some(
    (c: { anon_label: string }) => c.anon_label !== null
  )
  // More reliable: check by user_id
  const { data: myCheckin } = await db
    .from('session_checkins')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .maybeSingle()

  // Compute client-side progress
  const expected = session.expected_count
  const count    = session.checkin_count ?? 0
  let progress = 0
  if (count >= expected) {
    progress = 100
  } else if (count === expected - 1) {
    progress = 85
  } else if (expected > 0) {
    progress = Math.round((count / expected) * 85)
  }

  return NextResponse.json({
    session: {
      id:              session.id,
      state:           session.state,
      expected_count:  expected,
      checkin_count:   count,
      wheat_total:     session.wheat_total,
      scripture_cards: session.scripture_cards,
      amen_count:      session.amen_count ?? 0,
      started_at:      session.started_at,
      harvested_at:    session.harvested_at,
      progress,
    },
    checkins:      (checkins ?? []).map((c: { anon_label: string; checked_in_at: string }) => ({
      anon_label:     c.anon_label,
      checked_in_at:  c.checked_in_at,
    })),
    i_checked_in: !!myCheckin,
  })
}
