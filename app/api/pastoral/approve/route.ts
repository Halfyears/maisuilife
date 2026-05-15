/**
 * POST /api/pastoral/approve
 *
 * Level 3 — 成员授权或拒绝组长的关怀请求。
 *
 * 输入: { request_id: string, decision: 'approve' | 'deny' }
 *
 * 安全保证：
 *   - 只有 pastoral_requests.member_id === auth.uid() 才能更新
 *   - 更新仅限 status 和 responded_at 列（DB 的 WITH CHECK 约束）
 *   - APPROVED 后，pastoral/list 会在下次请求时开放 display_name
 *   - DENIED 后，人名永久不公开
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: { request_id?: string; decision?: string } = await req.json().catch(() => ({}))
  const { request_id, decision } = body

  if (!request_id || !decision || !['approve', 'deny'].includes(decision)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const newStatus = decision === 'approve' ? 'APPROVED' : 'DENIED'

  // The user-session client enforces RLS:
  //   "pastoral_requests: member responds"
  //   USING (member_id = auth.uid() AND status = 'PENDING')
  // so this UPDATE will silently no-op if caller is not the member
  // or if the request is already responded.
  const { data: updated, error: updateErr } = await supabase
    .from('pastoral_requests')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', request_id)
    .eq('member_id', user.id)       // belt-and-suspenders alongside RLS
    .eq('status', 'PENDING')
    .select('id, status')
    .single()

  if (updateErr || !updated) {
    // Request not found, already responded, or not owned by caller
    return NextResponse.json({ error: 'update_failed' }, { status: 409 })
  }

  return NextResponse.json({ success: true, status: updated.status })
}
