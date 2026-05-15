import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FellowshipView } from '@/components/fellowship/fellowship-view'
import type { FellowshipPostsResponse } from '@/app/api/fellowship/posts/route'

export const metadata = { title: '微光团契 — 麦穗喜乐' }

// Always fetch fresh (midnight purge changes visibility)
export const revalidate = 0

export default async function FellowshipPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Fetch user profile (role + display_name) ──────
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  // ── 2. Find the user's fellowship ────────────────────
  // For V1: take the first fellowship the user belongs to.
  const { data: membership } = await supabase
    .from('fellowship_members')
    .select('fellowship_id, layer2_label')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  // ── 3. Fetch posts via internal API ──────────────────
  // We call the internal route directly on the server to reuse
  // all the data-masking logic without duplicating it.
  let postsData: FellowshipPostsResponse | null = null

  if (membership) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const apiUrl  = `${baseUrl}/api/fellowship/posts?fellowship_id=${membership.fellowship_id}`

    // Pass the session cookie so the API route can authenticate
    const cookieHeader = (await import('next/headers')).cookies()
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')

    const res = await fetch(apiUrl, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    })

    if (res.ok) {
      postsData = await res.json()
    }
  }

  const isLeader = profile?.role === 'leader' || postsData?.is_leader

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-8">
      {/* ── Header ─────────────────────────────── */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            微光同行
          </p>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            {postsData?.fellowship_name ?? '团契'}
          </h1>
          {membership && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              以「{membership.layer2_label || '同行者'}」身份参与
            </p>
          )}
        </div>

        {/* ── Leader console entry (low-key, top-right) ── */}
        {isLeader && (
          <Link
            href="/fellowship/console"
            className={`
              flex items-center gap-1.5 rounded-lg border border-border
              px-3 py-1.5 text-xs text-muted-foreground
              hover:border-gold-300 hover:text-gold-700 hover:bg-gold-400/5
              transition-colors focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring
            `}
            title="组长牧养工具"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>预备团契</span>
          </Link>
        )}
      </header>

      {/* ── Unlock status banner ──────────────────── */}
      {postsData && !postsData.is_unlocked && (
        <div className="mb-5 rounded-xl border border-gold-200 bg-gold-400/8 px-4 py-3 text-sm text-gold-700">
          先把今日心声放在祂面前，团契的心声便向你开启。
        </div>
      )}

      {/* ── No fellowship state ───────────────────── */}
      {!membership && (
        <NoFellowshipState />
      )}

      {/* ── Fellowship view ───────────────────────── */}
      {postsData && (
        <FellowshipView data={postsData} />
      )}
    </main>
  )
}

// ── States ────────────────────────────────────────────────
function NoFellowshipState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="text-4xl">🌾</span>
      <p className="font-medium text-foreground">还未加入任何团契</p>
      <p className="text-sm text-muted-foreground max-w-[220px]">
        向你的团契组长索取邀请码，即可加入。
      </p>
      <Link
        href="/fellowship/join"
        className={`
          mt-2 rounded-xl border border-gold-300 bg-gold-400/10 px-5 py-2.5
          text-sm font-medium text-gold-700
          hover:bg-gold-400/20 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        `}
      >
        输入邀请码
      </Link>
    </div>
  )
}
