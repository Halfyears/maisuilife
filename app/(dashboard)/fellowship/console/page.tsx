import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Monitor, ExternalLink, Users } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { InsightCard } from '@/components/console/insight-card'
import { PastoralBoard } from '@/components/console/pastoral-board'
import { SpatialToggle } from '@/components/console/spatial-toggle'
import type { InsightResponse } from '@/app/api/fellowship/insight/route'
import type { PastoralListResponse } from '@/app/api/pastoral/list/route'

export const metadata = { title: '团契后台' }
export const revalidate = 0

const CONSOLE_ROLES = ['group_leader', 'church_admin', 'super_admin'] as const
type ConsoleRole = typeof CONSOLE_ROLES[number]

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  // ── Auth + role guard ──────────────────────────────────
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { role: string; display_name: string } | null

  if (!profile || !CONSOLE_ROLES.includes(profile.role as ConsoleRole)) {
    redirect('/fellowship')
  }

  const db = createServiceClient()
  const isPrivileged = profile.role === 'church_admin' || profile.role === 'super_admin'

  // ── Fellowship resolution ──────────────────────────────
  // group_leader → own fellowship
  // church_admin / super_admin + no ?id → show picker
  // church_admin / super_admin + ?id   → load that fellowship
  let fellowship: { id: string; name: string; meeting_mode: string; yt_link: string | null } | null = null

  type FellowshipRow = { id: string; name: string; meeting_mode: string; yt_link: string | null }
  type PickerRow     = { id: string; name: string; users?: { display_name: string } | null }

  if (isPrivileged && searchParams.id) {
    const { data } = await db
      .from('fellowships')
      .select('id, name, meeting_mode, yt_link')
      .eq('id', searchParams.id)
      .single()
    fellowship = data as FellowshipRow | null
  } else if (isPrivileged && !searchParams.id) {
    // Show fellowship picker
    const { data: all } = await db
      .from('fellowships')
      .select('id, name, users!leader_id(display_name)')
      .order('name')
    return <FellowshipPicker fellowships={(all ?? []) as PickerRow[]} displayName={profile.display_name} />
  } else {
    // group_leader: own fellowship
    const { data } = await db
      .from('fellowships')
      .select('id, name, meeting_mode, yt_link')
      .eq('leader_id', user.id)
      .single()
    fellowship = data as FellowshipRow | null
  }

  if (!fellowship) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">未找到对应团契。</p>
        <Link href="/fellowship" className="mt-4 block text-xs text-amber-600 underline underline-offset-2">
          返回团契
        </Link>
      </main>
    )
  }

  // ── Parallel-fetch: insight + pastoral list ────────────
  let insightData: InsightResponse       = { advice: '点击右上角刷新按钮加载建议', stats: [], generated_at: new Date().toISOString() }
  let pastoralData: PastoralListResponse = { pending_flags: [], requests: [] }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    if (baseUrl) {
      const cookieHeader = (await import('next/headers')).cookies()
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ')
      const headers = { Cookie: cookieHeader }

      const [insightRes, pastoralRes] = await Promise.all([
        fetch(`${baseUrl}/api/fellowship/insight?fellowship_id=${fellowship.id}`, { headers, cache: 'no-store' }),
        fetch(`${baseUrl}/api/pastoral/list?fellowship_id=${fellowship.id}`,     { headers, cache: 'no-store' }),
      ])
      if (insightRes.ok)  insightData  = await insightRes.json()
      if (pastoralRes.ok) pastoralData = await pastoralRes.json()
    }
  } catch {
    // InsightCard 有刷新按钮，用户可手动重试
  }

  const roleLabel = profile.role === 'super_admin' ? '超级管理员'
    : profile.role === 'church_admin' ? '教会管理员'
    : '组长'

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-8">
      {/* ── Header ─────────────────────────── */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {roleLabel}后台
            </p>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {fellowship.name}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {profile.display_name}
              {isPrivileged && (
                <Link
                  href="/fellowship/console"
                  className="ml-2 text-amber-600 underline underline-offset-2 hover:text-amber-700"
                >
                  切换团契
                </Link>
              )}
            </p>
          </div>

          {/* Projector link */}
          <Link
            href="/fellowship/console/projector"
            target="_blank"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold-300 hover:text-gold-700 hover:bg-gold-400/5 transition-colors"
          >
            <Monitor className="h-3.5 w-3.5" />
            投屏
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        {/* ── AI Insight ───────────────────── */}
        <InsightCard
          fellowshipId={fellowship.id}
          initial={insightData}
        />

        {/* ── Pastoral Board ───────────────── */}
        <PastoralBoard
          pendingFlags={pastoralData.pending_flags}
          requests={pastoralData.requests}
          fellowshipId={fellowship.id}
        />

        {/* ── Spatial Toggle + YT Link ─────── */}
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <SpatialToggle
            fellowshipId={fellowship.id}
            initialMode={fellowship.meeting_mode as 'in-person' | 'online'}
            ytLink={fellowship.yt_link}
          />
        </div>

        {/* ── Quick links ──────────────────── */}
        <div className="flex gap-3 text-xs">
          <Link
            href="/fellowship"
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            ← 返回团契
          </Link>
          {isPrivileged && (
            <Link
              href="/fellowship/console"
              className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              切换团契
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

// ── 团契选择器（church_admin / super_admin 无 ?id 时显示）─────────
function FellowshipPicker({
  fellowships,
  displayName,
}: {
  fellowships: { id: string; name: string; users?: { display_name: string } | null }[]
  displayName: string
}) {
  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">管理后台</p>
        <h1 className="font-serif text-2xl font-bold text-foreground">选择团契</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{displayName}</p>
      </header>

      {fellowships.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">尚未有任何团契。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fellowships.map((f) => (
            <li key={f.id}>
              <Link
                href={`/fellowship/console?id=${f.id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4
                           hover:border-amber-200 hover:bg-amber-50/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-lg">
                    <Users className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.name}</p>
                    {f.users?.display_name && (
                      <p className="text-xs text-muted-foreground">组长：{f.users.display_name}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-amber-600 transition-colors">
                  进入 →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Link href="/fellowship" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          ← 返回团契
        </Link>
      </div>
    </main>
  )
}
