/**
 * POST /api/auth/magic-link
 *
 * Body: { email: string; turnstileToken?: string; redirectTo?: string }
 *
 * 1. Verifies Cloudflare Turnstile token (if TURNSTILE_SECRET_KEY is set)
 * 2. Sends a Supabase magic-link OTP email
 * 3. The link redirects to /api/auth/callback?next=<redirectTo>
 *
 * Env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  (required)
 *   NEXT_PUBLIC_APP_URL       (recommended — falls back to request Host header)
 *   TURNSTILE_SECRET_KEY      (optional — skip verification if absent)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const ERROR = (code: string, status = 400) =>
  NextResponse.json({ error: code }, { status })

/** Build the absolute base URL from the request, with NEXT_PUBLIC_APP_URL taking priority. */
function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return ERROR('invalid_body')

  const { email, turnstileToken, redirectTo = '/' } = body as {
    email?: string; turnstileToken?: string; redirectTo?: string
  }

  if (!email || typeof email !== 'string') return ERROR('missing_email')
  const trimmedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return ERROR('invalid_email')

  // ── Cloudflare Turnstile verification ─────────────────
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (turnstileSecret) {
    if (!turnstileToken) return ERROR('turnstile_required')
    const resp = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken }),
      }
    ).catch(() => null)
    if (!resp?.ok) return ERROR('turnstile_error', 500)
    const result = await resp.json()
    if (!result.success) return ERROR('turnstile_failed', 403)
  }

  // ── Build redirect URL ─────────────────────────────────
  const baseUrl = getBaseUrl(req)
  // Ensure redirectTo is a relative path to prevent open redirect
  const safePath = (typeof redirectTo === 'string' && redirectTo.startsWith('/'))
    ? redirectTo
    : '/'
  const emailRedirectTo = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(safePath)}`

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

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmedEmail,
    options: {
      emailRedirectTo,
      shouldCreateUser: false, // only existing registered users
    },
  })

  if (error) {
    // Supabase may return various errors for non-existent emails depending on project settings.
    // We always return 200 to prevent email enumeration — the UI shows a generic "check inbox"
    // message regardless. Only log unexpected errors for debugging.
    const ignoredPhrases = [
      'Email not confirmed',
      'Signups not allowed for otp',
      'For security purposes',
      'User not found',
    ]
    const isExpected = ignoredPhrases.some(p => error.message.includes(p))
    if (!isExpected) {
      console.error('[magic-link] unexpected error:', error.message)
    } else {
      console.warn('[magic-link] suppressed:', error.message)
    }
  }

  // Always return ok — tell the user to check their inbox
  return NextResponse.json({ ok: true })
}
