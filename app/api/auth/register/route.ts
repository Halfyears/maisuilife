/**
 * POST /api/auth/register
 *
 * Open registration endpoint.
 * - Honeypot: if `website` field is non-empty → silent 200 (deceive bots)
 * - invite_code is optional; if valid, user joins the fellowship
 * - Uses service_role to create auth user + profile, bypassing email confirmation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const name        = (typeof body.name        === 'string' ? body.name.trim()        : '')
  const email       = (typeof body.email       === 'string' ? body.email.trim()       : '')
  const password    = (typeof body.password    === 'string' ? body.password           : '')
  const inviteCode  = (typeof body.invite_code === 'string' ? body.invite_code.trim() : '')
  const honeypot    = (typeof body.website     === 'string' ? body.website            : '')

  // ── Honeypot check — return 200 to fool bots ──────────
  if (honeypot.length > 0) {
    return NextResponse.json({ success: true })
  }

  // ── Basic validation ───────────────────────────────────
  if (!name || name.length < 2)  return NextResponse.json({ error: 'invalid_name' },  { status: 400 })
  if (!email)                    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  if (password.length < 6)       return NextResponse.json({ error: 'weak_password' }, { status: 400 })

  const db = createServiceClient()

  // ── Create auth user (auto-confirm email) ─────────────
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  })

  if (authErr) {
    const code = authErr.message?.includes('already') ? 'email_taken' : 'create_failed'
    return NextResponse.json({ error: code }, { status: 400 })
  }

  const userId = authData.user.id

  // ── Insert user profile ────────────────────────────────
  // upsert 防止 signup trigger 已建行导致 unique 冲突
  const { error: profileErr } = await db.from('users').upsert({
    id:           userId,
    display_name: name,
    role:         'member',
    settings:     { elder_mode: false },
  }, { onConflict: 'id' })

  if (profileErr) {
    // Roll back: delete the auth user so they can retry
    await db.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'profile_failed' }, { status: 500 })
  }

  // ── Optionally join fellowship ─────────────────────────
  if (inviteCode) {
    const { data: fellowship } = await db
      .from('fellowships')
      .select('id')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (fellowship) {
      await db.from('fellowship_members').insert({
        fellowship_id: fellowship.id,
        user_id:       userId,
        layer2_label:  'member',
        joined_at:     new Date().toISOString(),
      }).catch(() => null)  // non-fatal
    }
  }

  return NextResponse.json({ success: true })
}
