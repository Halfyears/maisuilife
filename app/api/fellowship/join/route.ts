/**
 * POST /api/fellowship/join
 * Body: { invite_code: string }
 *
 * Looks up the fellowship by invite_code, then adds the authenticated user
 * as a member. Returns 409 if the user is already in any fellowship.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Auth: verify user session via cookie-based client
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const inviteCode = (typeof body?.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : '')
  if (!inviteCode) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 })
  }

  // Use admin client (no user JWT) so RLS is truly bypassed for all DB ops below
  const db = createAdminClient()

  // ── 1. Check if user is already a member ──────────────
  const { data: existing } = await db
    .from('fellowship_members')
    .select('fellowship_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'already_member' }, { status: 409 })
  }

  // ── 2. Look up fellowship by invite_code ───────────────
  const { data: fellowship, error: lookupErr } = await db
    .from('fellowships')
    .select('id, name, status, church_id')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (lookupErr) {
    console.error('[fellowship/join] lookup error:', lookupErr.message)
    return NextResponse.json({ error: 'join_failed' }, { status: 500 })
  }

  if (!fellowship) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 404 })
  }

  if (fellowship.status !== 'approved') {
    return NextResponse.json({ error: 'fellowship_not_approved' }, { status: 403 })
  }

  // ── 3. Get user display_name for layer2_label ──────────
  const { data: profile } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  // ── 4. Insert membership ───────────────────────────────
  const { error: insertErr } = await db
    .from('fellowship_members')
    .insert({
      fellowship_id: fellowship.id,
      user_id:       user.id,
      layer2_label:  profile?.display_name ?? '同行者',
      joined_at:     new Date().toISOString(),
    })

  if (insertErr) {
    console.error('[fellowship/join] insert error:', insertErr.message)
    return NextResponse.json({ error: 'join_failed' }, { status: 500 })
  }

  // ── 5. Auto-join church if fellowship belongs to one ────
  const churchId = (fellowship as { church_id?: string | null }).church_id
  if (churchId) {
    const { data: alreadyChurchMember } = await db
      .from('church_members')
      .select('church_id')
      .eq('user_id', user.id)
      .eq('church_id', churchId)
      .maybeSingle()

    if (!alreadyChurchMember) {
      await db.from('church_members').insert({ church_id: churchId, user_id: user.id })
    }
  }

  return NextResponse.json({ ok: true, fellowship_name: fellowship.name })
}
