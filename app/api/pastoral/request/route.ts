/**
 * POST /api/pastoral/request
 *
 * Level 2 — 组长发起关怀请求。
 *
 * 输入: { flag_id: string }
 * 流程:
 *   1. 验证调用者是该团契的组长
 *   2. 从 urgent_flags 取出 user_id (成员身份)
 *   3. 创建 pastoral_request (status='PENDING')
 *   4. 返回成功 — 不返回任何成员信息
 *
 * 人名红线：此端点将 user_id 写入 pastoral_requests.member_id，
 * 但不从任何响应中泄露它。member_id 的可见性完全由 pastoral/list
 * 的 APPROVED 检查控制。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { flag_id }: { flag_id?: string } = await req.json().catch(() => ({}))
  if (!flag_id) {
    return NextResponse.json({ error: 'missing_flag_id' }, { status: 400 })
  }

  const db = createServiceClient()

  // ── Fetch the urgent flag ──────────────────────────────
  // This is the only moment member_id is retrieved from the DB.
  // It stays in server memory and is written to pastoral_requests
  // as an internal FK — never returned to the caller.
  const { data: flag } = await db
    .from('urgent_flags')
    .select('id, fellowship_id, user_id')
    .eq('id', flag_id)
    .single()

  if (!flag) {
    return NextResponse.json({ error: 'flag_not_found' }, { status: 404 })
  }

  // ── Verify caller is the leader of the flag's fellowship ──
  const { data: fellowship } = await db
    .from('fellowships')
    .select('leader_id')
    .eq('id', flag.fellowship_id)
    .single()

  if (!fellowship || fellowship.leader_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Guard: don't create duplicate requests ─────────────
  const { data: existing } = await db
    .from('pastoral_requests')
    .select('id, status')
    .eq('urgent_flag_id', flag_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ success: true, already_exists: true, status: existing.status })
  }

  // ── Create the pastoral request ────────────────────────
  // member_id written internally; nothing returned to caller
  const { error: insertErr } = await db
    .from('pastoral_requests')
    .insert({
      urgent_flag_id: flag_id,
      fellowship_id:  flag.fellowship_id,
      leader_id:      user.id,
      member_id:      flag.user_id,   // internal FK — NEVER returned
      status:         'PENDING',
    })

  if (insertErr) {
    console.error('[pastoral/request] insert error:', insertErr.code)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  // Return only confirmation — zero member information
  return NextResponse.json({ success: true })
}
