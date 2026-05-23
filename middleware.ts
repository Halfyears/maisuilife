import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes requiring auth (any role)
const AUTH_REQUIRED = ['/daily', '/fellowship', '/accountability', '/settings', '/growth']
// Public sub-paths that must bypass the AUTH_REQUIRED check above
const PUBLIC_EXCEPTIONS = ['/fellowship/join', '/fellowship/confirm-leader', '/accountability/join']
// Routes requiring super_admin (DB check happens in layout, middleware only checks auth)
const ADMIN_PATHS   = ['/admin']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // ── 1. Auth-required routes → redirect to login ────────
  const isPublicException = PUBLIC_EXCEPTIONS.some(e => pathname === e || pathname.startsWith(e + '/'))
  const needsAuth = (
    AUTH_REQUIRED.some(p => pathname.startsWith(p)) && !isPublicException
  ) || ADMIN_PATHS.some(p => pathname.startsWith(p))

  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Preserve query string so invite codes survive the login redirect
    const search = request.nextUrl.search
    loginUrl.searchParams.set('redirect', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  // ── 2. Admin routes — super_admin check is in layout.tsx ─
  // Middleware only ensures authentication. The server component
  // layout performs the DB role query to prevent edge-runtime DB calls.

  // ── 3. Already-logged-in → skip login/register ─────────
  if ((pathname === '/login' || pathname === '/register') && user) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}

export const config = {
  // Skip static files, images, health check, and the auth callback (it manages its own session)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|api/auth/callback).*)'],
}
