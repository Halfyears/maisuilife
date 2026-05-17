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

  // ── 2. Find the user's fellowship membership ─────────
  // Avoid the fellowships(status) PostgREST join — it's fragile if the status
  // column migration hasn't been applied. Users are only inserted into
  // fellowship_members for approved fellowships, so no status filter needed.
  const { data: membershipRow } = await supabase
    .from('fellowship_members')
    .select('fellowship_id, layer2_label')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const membership = membershipRow ?? null

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

  const isLeader = profile?.role === 'group_leader' || postsData?.is_leader

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
    <div className="flex flex-col gap-5 py-4">

      {/* 欢迎语 */}
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full
                        bg-gradient-to-br from-amber-100 to-orange-100 text-3xl shadow-sm">
          🌾
        </div>
        <div>
          <p className="text-base font-bold text-stone-900 tracking-wide">还未加入任何麦穗小组</p>
          <p className="mt-1.5 text-sm font-medium text-stone-500 leading-snug">
            在这里，与弟兄姐妹彼此联结，同行成长。
          </p>
        </div>
      </div>

      {/* ── 加入现有团契 ─────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-md shadow-amber-900/5 border border-stone-100">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xl">👥</span>
          <p className="text-sm font-bold text-stone-900">加入现有麦穗团契</p>
        </div>
        <Link
          href="/fellowship/join"
          className="flex items-center justify-center w-full rounded-xl
                     border border-amber-200 bg-amber-50/80 px-5 py-3
                     text-sm font-bold text-amber-700 hover:bg-amber-100
                     transition-colors active:scale-[0.99]"
        >
          输入 6 位邀请码加入
        </Link>
        <span className="text-stone-400 text-xs mt-2.5 px-1 block leading-relaxed">
          💡 提示：麦穗团契为私密守望小组。若您已有受邀团队，请向您的真实团契组长索取 6 位邀请码输入即可。
        </span>
      </div>

      {/* ── 创建新麦穗小组 ─────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-md shadow-amber-900/5 border border-stone-100">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xl">🌾</span>
          <p className="text-sm font-bold text-stone-900">创建新麦穗小组</p>
        </div>
        <Link
          href="/fellowship/create"
          className="flex items-center justify-center w-full rounded-xl
                     bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                     px-5 py-3 text-sm font-bold text-white
                     shadow-md shadow-orange-500/20 hover:opacity-90
                     transition-opacity active:scale-[0.99]"
        >
          ＋ 立即创建新麦穗小组
        </Link>
        <span className="text-stone-500 text-sm mt-3 tracking-wide block italic text-center leading-relaxed">
          ✨ 开启属于你们的属灵同行之旅，在生命的话语中建立风雨同舟的守望关系。
        </span>
      </div>

    </div>
  )
}
