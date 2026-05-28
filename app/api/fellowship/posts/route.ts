/**
 * GET /api/fellowship/posts?fellowship_id=<uuid>
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  数据分层安全模型                                         ║
 * ║                                                          ║
 * ║  本端点使用 service_role 客户端绕开 RLS，在应用层执行     ║
 * ║  精确的内容管控：                                        ║
 * ║                                                          ║
 * ║  ┌─ 查看者未交账 ─────────────────────────────────────┐ ║
 * ║  │  ai_summary_enc  → 永不解密，永不传输              │ ║
 * ║  │  summary in JSON → null                            │ ║
 * ║  └────────────────────────────────────────────────────┘ ║
 * ║                                                          ║
 * ║  ┌─ 查看者已交账（含静默）───────────────────────────┐  ║
 * ║  │  ai_summary_enc  → 在此函数内解密                  │  ║
 * ║  │  summary in JSON → 明文摘要（≤140字）              │  ║
 * ║  └────────────────────────────────────────────────────┘  ║
 * ║                                                          ║
 * ║  加密原始字节 (ai_summary_enc) 绝不出现在响应 JSON 中。  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

// ── Response types (what the client ever sees) ────────────
export interface FellowshipPost {
  alignment_id: string
  layer2_label: string
  status_tag: string
  is_silent: boolean
  is_self: boolean
  react_nian: number
  react_amen: number
  /** null  → viewer has not submitted → content gated
   *  string → viewer has submitted    → decrypted ≤140 chars */
  summary: string | null
}

export interface FellowshipPostsResponse {
  fellowship_id: string
  fellowship_name: string
  is_unlocked: boolean
  is_leader: boolean
  posts: FellowshipPost[]
}

// ── Raw DB row shape (never exported) ─────────────────────
interface AlignmentRow {
  id: string
  user_id: string
  status_tag: string
  is_silent: boolean
  is_visible: boolean
  react_nian: number
  react_amen: number
  ai_summary_enc: string | null   // hex string e.g. "\\x0a1b..."
}

export async function GET(req: NextRequest) {
  // ── 0. Auth ───────────────────────────────────────────
  const supabase = createClient()
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const fellowshipId = req.nextUrl.searchParams.get('fellowship_id')
  if (!fellowshipId) {
    return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })
  }

  // 优先使用客户端传来的本地日期（?client_date=YYYY-MM-DD），
  // 确保与内室提交和静默同行使用同一日期键；回退至服务器 UTC 日期
  const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/
  const clientDate = req.nextUrl.searchParams.get('client_date') ?? ''

  // ── 1. Service-role client for raw queries ────────────
  // Using service role so we can apply our own access rules
  // rather than fighting RLS for cross-member reads.
  const db = createServiceClient()

  // ── 2. Verify caller is a member of this fellowship ───
  const { data: callerMembership } = await db
    .from('fellowship_members')
    .select('layer2_label')
    .eq('fellowship_id', fellowshipId)
    .eq('user_id', user.id)
    .single()

  if (!callerMembership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── 3. Fetch fellowship metadata ──────────────────────
  const { data: fellowship } = await db
    .from('fellowships')
    .select('name, leader_id')
    .eq('id', fellowshipId)
    .single()

  if (!fellowship) {
    return NextResponse.json({ error: 'fellowship_not_found' }, { status: 404 })
  }

  // ── 4. Fetch all members (≤ 12) ───────────────────────
  const { data: members } = await db
    .from('fellowship_members')
    .select('user_id, layer2_label')
    .eq('fellowship_id', fellowshipId)
    .limit(12)

  if (!members || members.length === 0) {
    return NextResponse.json<FellowshipPostsResponse>({
      fellowship_id:   fellowshipId,
      fellowship_name: fellowship.name,
      is_unlocked:     false,
      is_leader:       fellowship.leader_id === user.id,
      posts:           [],
    })
  }

  const memberIds = members.map((m) => m.user_id)
  const today     = DATE_RE.test(clientDate)
    ? clientDate
    : new Date().toISOString().slice(0, 10)

  // ── 5. Fetch today's visible alignments for all members ─
  // SELECT only columns needed. ai_summary_enc is fetched but
  // will be decrypted here and NEVER forwarded to the client.
  const { data: alignments } = await db
    .from('daily_alignments')
    .select('id, user_id, status_tag, is_silent, is_visible, react_nian, react_amen, ai_summary_enc')
    .in('user_id', memberIds)
    .eq('date', today)
    .eq('is_visible', true)
    .returns<AlignmentRow[]>()

  // ── 6. Determine if the viewer has submitted today ─────
  // Silent entries count as "submitted" — they unlock the view.
  const viewerHasSubmitted = (alignments ?? []).some(
    (a) => a.user_id === user.id
  )

  // ── 7. Build label lookup ──────────────────────────────
  const labelByUserId = Object.fromEntries(
    members.map((m) => [m.user_id, m.layer2_label])
  )

  // ── 8. Map rows → response posts ──────────────────────
  // Critical: ai_summary_enc is consumed here and never placed
  // into the response object.
  const posts: FellowshipPost[] = (alignments ?? []).map((row) => {
    let summary: string | null = null

    if (viewerHasSubmitted && row.ai_summary_enc && !row.is_silent) {
      // Decrypt only when the viewer has earned access.
      // Any decryption failure silently yields null (no crash, no leak).
      try {
        const hex = row.ai_summary_enc.replace(/^\\x/, '')
        const buf = Buffer.from(hex, 'hex')
        summary   = decrypt(buf)
      } catch {
        summary = null
      }
    }
    // ai_summary_enc is intentionally excluded from the returned object.

    return {
      alignment_id: row.id,
      layer2_label: labelByUserId[row.user_id] ?? '同行者',
      status_tag:   row.status_tag,
      is_silent:    row.is_silent,
      is_self:      row.user_id === user.id,
      react_nian:   row.react_nian,
      react_amen:   row.react_amen,
      summary,      // null | decrypted string — never raw bytes
    } satisfies FellowshipPost
  })

  // Sort: own post first, then others
  posts.sort((a, b) => Number(b.is_self) - Number(a.is_self))

  return NextResponse.json<FellowshipPostsResponse>({
    fellowship_id:   fellowshipId,
    fellowship_name: fellowship.name,
    is_unlocked:     viewerHasSubmitted,
    is_leader:       fellowship.leader_id === user.id,
    posts,
  })
}
