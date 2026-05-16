import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FellowshipView } from '@/components/fellowship/fellowship-view'
import { BottomNav } from '@/components/shared/bottom-nav'
import type { FellowshipPostsResponse } from '@/app/api/fellowship/posts/route'

export const metadata = { title: '麦穗团契 — 麦穗喜乐' }

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
    <div className="flex min-h-dvh flex-col">
      {/* ── Sticky header ──────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
              麦穗喜乐
            </p>
            <h1 className="text-base font-bold text-stone-900">
              {postsData?.fellowship_name ?? '麦穗团契'}
            </h1>
          </div>

          {isLeader && (
            <Link
              href="/fellowship/console"
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                         px-3 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              预备团契
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-32">
        {membership && (
          <p className="mb-4 text-xs font-medium text-stone-400">
            以「{membership.layer2_label || '同行者'}」身份参与
          </p>
        )}

        {/* ── Unlock status banner ──────────────────── */}
        {postsData && !postsData.is_unlocked && (
          <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
            先把今日心声放在祂面前，团契的心声便向你开启。
          </div>
        )}

        {/* ── No fellowship state ───────────────────── */}
        {!membership && <NoFellowshipState />}

        {/* ── Fellowship view ───────────────────────── */}
        {postsData && <FellowshipView data={postsData} />}
      </main>

      <BottomNav />
    </div>
  )
}

function NoFellowshipState() {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full
                      bg-gradient-to-br from-amber-100 to-orange-100 text-3xl shadow-sm">
        🌾
      </div>
      <div>
        <p className="text-base font-bold text-stone-900 tracking-wide">还未加入任何麦穗小组</p>
        <p className="mt-1.5 max-w-[240px] text-sm font-medium text-stone-500 leading-snug">
          在这里，你可以与弟兄姐妹彼此联结，同行成长。
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {/* Option 1: join via invite code */}
        <Link
          href="/fellowship/join"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80
                     px-5 py-4 transition-all hover:border-amber-300 hover:bg-amber-50 active:scale-[0.98]"
        >
          <span className="text-2xl">👥</span>
          <div className="text-left">
            <p className="text-sm font-bold text-stone-900">输入邀请码加入现有团契</p>
            <p className="text-xs font-medium text-stone-500 mt-0.5">向你的组长索取 6 位邀请码</p>
          </div>
        </Link>

        {/* Option 2: create new group */}
        <Link
          href="/fellowship/create"
          className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white/90
                     px-5 py-4 shadow-sm transition-all hover:border-stone-200 active:scale-[0.98]"
        >
          <span className="text-2xl">🌾</span>
          <div className="text-left">
            <p className="text-sm font-bold text-stone-900">创建新麦穗小组</p>
            <p className="text-xs font-medium text-stone-500 mt-0.5">开启属于你们的属灵同行之旅</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
