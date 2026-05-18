import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings2, Home } from 'lucide-react'
import { FellowshipInviteCard } from '@/components/fellowship/copy-link-button'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { FellowshipView } from '@/components/fellowship/fellowship-view'
import { PrayerSection } from '@/components/fellowship/prayer-section'
import { BottomNav } from '@/components/shared/bottom-nav'
import type { FellowshipPost, FellowshipPostsResponse } from '@/app/api/fellowship/posts/route'
import type { PrayerRequestItem } from '@/app/api/prayer/route'

export const metadata = { title: '麦穗团契 — 麦穗喜乐' }

// Always fetch fresh (midnight purge changes visibility)
export const revalidate = 0

interface AlignmentRow {
  id: string
  user_id: string
  status_tag: string
  is_silent: boolean
  is_visible: boolean
  react_nian: number
  react_amen: number
  ai_summary_enc: string | null
}

export default async function FellowshipPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  // ── 1. Fetch user profile ────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  // ── 2. Find fellowship membership ────────────────────
  const { data: membershipRow } = await supabase
    .from('fellowship_members')
    .select('fellowship_id, layer2_label')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const membership = membershipRow ?? null

  // ── 3. Fetch posts directly (no HTTP self-call) ──────
  let postsData: FellowshipPostsResponse | null = null
  let fellowshipInviteCode: string | null = null

  if (membership) {
    const db = createServiceClient()
    const fellowshipId = membership.fellowship_id

    const [{ data: fellowship }, { data: members }] = await Promise.all([
      db.from('fellowships').select('name, leader_id, invite_code').eq('id', fellowshipId).single(),
      db.from('fellowship_members').select('user_id, layer2_label').eq('fellowship_id', fellowshipId).limit(12),
    ])

    if (fellowship) {
      fellowshipInviteCode = (fellowship as { invite_code: string }).invite_code ?? null
    }

    if (fellowship && members && members.length > 0) {
      const memberIds = (members as { user_id: string; layer2_label: string }[]).map(m => m.user_id)

      // Use UTC+8 so the date matches what /api/align stores
      const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)

      // Always include viewer's user_id even if they fall outside the member page limit
      const queryIds = memberIds.includes(user.id) ? memberIds : [...memberIds, user.id]

      const [{ data: alignments }, { data: viewerRow }] = await Promise.all([
        db
          .from('daily_alignments')
          .select('id, user_id, status_tag, is_silent, is_visible, react_nian, react_amen, ai_summary_enc')
          .in('user_id', queryIds)
          .eq('date', today)
          .eq('is_visible', true)
          .returns<AlignmentRow[]>(),
        // Separate authoritative check — not affected by member page limit
        db
          .from('daily_alignments')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today)
          .eq('is_visible', true)
          .maybeSingle(),
      ])

      const viewerHasSubmitted = !!viewerRow

      const labelByUserId = Object.fromEntries(
        (members as { user_id: string; layer2_label: string }[]).map(m => [m.user_id, m.layer2_label])
      )

      const posts: FellowshipPost[] = (alignments ?? []).map(row => {
        let summary: string | null = null
        if (viewerHasSubmitted && row.ai_summary_enc && !row.is_silent) {
          try {
            const hex = row.ai_summary_enc.replace(/^\\x/, '')
            const buf = Buffer.from(hex, 'hex')
            summary = decrypt(buf)
          } catch {
            summary = null
          }
        }
        return {
          alignment_id: row.id,
          layer2_label: labelByUserId[row.user_id] ?? '同行者',
          status_tag:   row.status_tag,
          is_silent:    row.is_silent,
          is_self:      row.user_id === user.id,
          react_nian:   row.react_nian,
          react_amen:   row.react_amen,
          summary,
        } satisfies FellowshipPost
      })

      posts.sort((a, b) => Number(b.is_self) - Number(a.is_self))

      postsData = {
        fellowship_id:   fellowshipId,
        fellowship_name: fellowship.name,
        is_unlocked:     viewerHasSubmitted,
        is_leader:       (fellowship as { leader_id: string }).leader_id === user.id,
        posts,
      }
    }
  }

  // ── 4. 预取代祷需求 ──────────────────────────────────
  let prayerRequests: PrayerRequestItem[] = []
  if (membership) {
    const db = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: rows } = await db
      .from('prayer_requests')
      .select('id, user_id, display_name, is_anonymous, title, content, is_resolved, created_at, prayer_commitments(user_id, total_count, last_prayed)')
      .eq('fellowship_id', membership.fellowship_id)
      .order('is_resolved', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(30)

    prayerRequests = (rows ?? []).map((r: {
      id: string; user_id: string; display_name: string; is_anonymous: boolean;
      title: string; content: string | null; is_resolved: boolean; created_at: string;
      prayer_commitments: { user_id: string; total_count: number; last_prayed: string }[]
    }) => {
      const commitments = r.prayer_commitments ?? []
      const mine = commitments.find(c => c.user_id === user.id)
      return {
        id:             r.id,
        is_self:        r.user_id === user.id,
        requester:      r.is_anonymous ? null : r.display_name,
        is_anonymous:   r.is_anonymous,
        title:          r.title,
        content:        r.content ?? null,
        is_resolved:    r.is_resolved,
        created_at:     r.created_at,
        pray_count:     commitments.length,
        total_prayers:  commitments.reduce((s, c) => s + c.total_count, 0),
        i_committed:    !!mine,
        i_prayed_today: mine ? mine.last_prayed.slice(0, 10) === today : false,
      } satisfies PrayerRequestItem
    })
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

          <div className="flex items-center gap-2">
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
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                         px-3 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              首页
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-5 pb-32">
        {membership && (
          <p className="mb-4 text-xs font-medium text-stone-400">
            以「{membership.layer2_label || '同行者'}」身份参与
          </p>
        )}

        {/* ── 邀请码卡片 ───────────────────────────────── */}
        {membership && fellowshipInviteCode && (
          <div className="mb-5">
            <FellowshipInviteCard code={fellowshipInviteCode} />
          </div>
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

        {/* ── 代祷需求 ──────────────────────────────── */}
        {membership && (
          <PrayerSection
            fellowshipId={membership.fellowship_id}
            initialRequests={prayerRequests}
          />
        )}
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
