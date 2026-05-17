/**
 * GET /api/auth/callback
 *
 * Handles two flows:
 *   1. OAuth (Google / Apple): receives ?code=… from Supabase PKCE exchange
 *   2. Magic link / email verification: receives ?token_hash=…&type=magiclink
 *
 * After successful session creation, redirects to ?next= (default: /)
 * On failure, redirects to /login?error=auth_failed
 *
 * Add this URL to Supabase dashboard → Auth → URL Configuration → Redirect URLs:
 *   https://your-domain.com/api/auth/callback
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const tokenHash  = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'magiclink' | 'recovery' | 'signup' | null
  const next       = searchParams.get('next') ?? '/'

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

  let authError: Error | null = null

  // ── Flow 1: OAuth PKCE code exchange ──────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) authError = error
  }
  // ── Flow 2: Magic link / OTP token_hash ───────────────
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) authError = error
  }
  // ── Unknown / missing params ──────────────────────────
  else {
    authError = new Error('no_code_or_token')
  }

  if (authError) {
    console.error('[auth/callback]', authError.message)
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
