import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Monitor, ExternalLink } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { InsightCard } from '@/components/console/insight-card'
import { PastoralBoard } from '@/components/console/pastoral-board'
import { SpatialToggle } from '@/components/console/spatial-toggle'
import type { InsightResponse } from '@/app/api/fellowship/insight/route'
import type { PastoralListResponse } from '@/app/api/pastoral/list/route'

export const metadata = { title: '预备团契 — 组长后台' }
export const revalidate = 0

export default async function ConsolePage() {
  // ── Auth + leader guard ────────────────────────────────
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'group_leader') redirect('/fellowship')

  // ── Find fellowship led by this user ──────────────────
  const db = createServiceClient()
  const { data: fellowship } = await db
    .from('fellowships')
    .select('id, name, meeting_mode, yt_link')
    .eq('leader_id', user.id)
    .single()

  if (!fellowship) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-muted-foreground">尚未创建团契。</p>
      </main>
    )
  }

  // ── Parallel-fetch: insight + pastoral list ────────────
  // 用绝对 URL 调用自身 API，包裹 try-catch 防止 URL 未配置时崩溃
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

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-8">
      {/* ── Header ─────────────────────────────── */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              组长后台
            </p>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              预备团契
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fellowship.name} · {profile.display_name}
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
        <div className="flex gap-2 text-xs">
          <Link
            href="/fellowship"
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            ← 返回团契
          </Link>
        </div>
      </div>
    </main>
  )
}
