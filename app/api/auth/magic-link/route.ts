/**
 * POST /api/auth/magic-link
 *
 * Body: { email: string; turnstileToken?: string; redirectTo?: string }
 *
 * 1. Verifies Cloudflare Turnstile token (if TURNSTILE_SECRET_KEY is set)
 * 2. Sends a Supabase magic-link email to the address
 * 3. The link redirects to /api/auth/callback?next=<redirectTo>
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (always)
 *   TURNSTILE_SECRET_KEY          (optional — skip verification if absent)
 *   NEXT_PUBLIC_APP_URL           (used to build the emailRedirectTo URL)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const ERROR = (code: string, status = 400) =>
  NextResponse.json({ error: code }, { status })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return ERROR('invalid_body')

  const { email, turnstileToken, redirectTo = '/' } = body as {
    email?: string; turnstileToken?: string; redirectTo?: string
  }

  if (!email || typeof email !== 'string') return ERROR('missing_email')

  // ── Cloudflare Turnstile verification ─────────────────
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (turnstileSecret) {
    if (!turnstileToken) return ERROR('turnstile_required')

    const resp = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret:   turnstileSecret,
          response: turnstileToken,
        }),
      }
    ).catch(() => null)

    if (!resp?.ok) return ERROR('turnstile_error', 500)
    const result = await resp.json()
    if (!result.success) return ERROR('turnstile_failed', 403)
  }

  // ── Send magic link via Supabase ──────────────────────
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const emailRedirectTo = `${appUrl}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  })

  // Supabase returns an error when the email is not registered,
  // but we intentionally return success to avoid email enumeration.
  if (error && error.message !== 'Email not confirmed') {
    console.error('[magic-link]', error.message)
    return ERROR('send_failed', 500)
  }

  return NextResponse.json({ ok: true })
}
