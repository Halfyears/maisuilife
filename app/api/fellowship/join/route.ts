/**
 * POST /api/fellowship/join
 * Body: { invite_code: string }
 *
 * Looks up the fellowship by invite_code, then adds the authenticated user
 * as a member. Returns 409 if the user is already in any fellowship.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
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

  const db = createServiceClient()

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
  const { data: fellowship } = await db
    .from('fellowships')
    .select('id, name, status')
    .eq('invite_code', inviteCode)
    .maybeSingle()

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
    .single()

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
    console.error('[fellowship/join]', insertErr.message)
    return NextResponse.json({ error: 'join_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fellowship_name: fellowship.name })
}
