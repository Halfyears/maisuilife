/**
 * GET /api/pastoral/list?fellowship_id=<uuid>
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  人名红线 — 三段式授权状态机的视图层                         ║
 * ║                                                              ║
 * ║  本端点是唯一将 member_id → display_name 解析的地方。        ║
 * ║                                                              ║
 * ║  授权矩阵：                                                  ║
 * ║  ┌─────────────┬──────────────┬────────────────────────┐    ║
 * ║  │ 请求状态    │ 返回人名     │ 说明                   │    ║
 * ║  ├─────────────┼──────────────┼────────────────────────┤    ║
 * ║  │ PENDING     │  null        │ 人名锁定               │    ║
 * ║  │ DENIED      │  null        │ 人名永久锁定           │    ║
 * ║  │ APPROVED    │  display_name│ 成员主动授权后公开     │    ║
 * ║  └─────────────┴──────────────┴────────────────────────┘    ║
 * ║                                                              ║
 * ║  member_id 绝不出现在任何响应 JSON 中。                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 响应结构：
 *  {
 *    pending_flags: AnonymousFlag[]    // 待处理的匿名代祷信号
 *    requests:      PastoralCard[]     // 已发起的关怀请求
 *  }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ── Public response types (never contain member_id) ───────

export interface AnonymousFlag {
  flag_id:    string
  flagged_at: string
  // No user_id, no layer2_label — completely anonymous signal
}

export interface PastoralCard {
  request_id:   string
  status:       'PENDING' | 'APPROVED' | 'DENIED'
  created_at:   string
  responded_at: string | null
  /** null for PENDING/DENIED — only populated when APPROVED */
  member_name:  string | null
  /** member_id is NEVER included */
}

export interface PastoralListResponse {
  pending_flags: AnonymousFlag[]
  requests:      PastoralCard[]
}

export async function GET(req: NextRequest) {
  // ── Auth + leader guard ────────────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const fellowshipId = req.nextUrl.searchParams.get('fellowship_id')
  if (!fellowshipId) {
    return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify the caller is the leader of this fellowship
  const { data: fellowship } = await db
    .from('fellowships')
    .select('leader_id')
    .eq('id', fellowshipId)
    .single()

  if (!fellowship || fellowship.leader_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── 1. Pending urgent flags (not yet addressed) ────────
  // We join urgent_flags with pastoral_requests to exclude
  // flags that already have a request created.
  // Returns ONLY flag_id and flagged_at — zero identifying info.
  const { data: rawFlags } = await db
    .from('urgent_flags')
    .select('id, flagged_at, pastoral_requests(id)')
    .eq('fellowship_id', fellowshipId)
    .order('flagged_at', { ascending: false })
    .limit(20)

  // Filter to flags without an existing request
  const pendingFlags: AnonymousFlag[] = (rawFlags ?? [])
    .filter((f: { pastoral_requests: unknown[] }) => (f.pastoral_requests as unknown[]).length === 0)
    .map((f: { id: string; flagged_at: string }) => ({
      flag_id:    f.id,
      flagged_at: f.flagged_at,
    }))

  // ── 2. Existing pastoral requests ─────────────────────
  const { data: rawRequests } = await db
    .from('pastoral_requests')
    .select('id, status, created_at, responded_at, member_id')
    .eq('fellowship_id', fellowshipId)
    .eq('leader_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // ── 3. Resolve display_name ONLY for APPROVED requests ─
  //
  // This is the exact enforcement of the human-name redline:
  //
  //   Step A: collect member_ids of APPROVED requests only
  //   Step B: batch-fetch their display_names in a single query
  //   Step C: map to response — NEVER include member_id in output
  //
  const approvedIds: string[] = (rawRequests ?? [])
    .filter((r: { status: string }) => r.status === 'APPROVED')
    .map((r: { member_id: string }) => r.member_id)

  const nameMap: Record<string, string> = {}

  if (approvedIds.length > 0) {
    // Step B: one query, minimal columns
    const { data: approvedUsers } = await db
      .from('users')
      .select('id, display_name')
      .in('id', approvedIds)

    // Build lookup: userId → display_name
    // This map only exists in server memory for the duration of this request
    ;(approvedUsers ?? []).forEach((u: { id: string; display_name: string }) => {
      nameMap[u.id] = u.display_name
    })
  }

  // Step C: map requests → PastoralCard (member_id stripped)
  const requests: PastoralCard[] = (rawRequests ?? []).map(
    (r: { id: string; status: string; created_at: string; responded_at: string | null; member_id: string }) => ({
      request_id:   r.id,
      status:       r.status as PastoralCard['status'],
      created_at:   r.created_at,
      responded_at: r.responded_at,
      // HUMAN-NAME REDLINE: name appears if and only if status === 'APPROVED'
      member_name:  r.status === 'APPROVED'
                      ? (nameMap[r.member_id] ?? '已授权成员')
                      : null,
    })
  )

  return NextResponse.json<PastoralListResponse>({ pending_flags: pendingFlags, requests })
}
