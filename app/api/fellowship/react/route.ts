/**
 * POST /api/fellowship/react
 *
 * 脉冲互动：原子自增 react_nian 或 react_amen。
 * 设计原则：不记录是谁点击，仅累计次数。
 * 重复点击合法（无去重），符合"记念"的祷告语义。
 *
 * Body: { alignment_id: string, reaction: 'nian' | 'amen' }
 * Response: { react_nian: number, react_amen: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type ReactionType = 'nian' | 'amen'

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const alignmentId: string | undefined = body.alignment_id
  const reaction: ReactionType | undefined = body.reaction

  if (!alignmentId || !reaction || !['nian', 'amen'].includes(reaction)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const db = createServiceClient()

  // ── Verify the alignment belongs to the user's fellowship ──
  // Prevents reacting to alignments outside your group.
  const { data: targetAlignment } = await db
    .from('daily_alignments')
    .select('user_id, date, is_visible')
    .eq('id', alignmentId)
    .single()

  if (!targetAlignment || !targetAlignment.is_visible) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Confirm the target user shares a fellowship with the caller
  const { data: sharedFellowship } = await db
    .from('fellowship_members')
    .select('fellowship_id')
    .eq('user_id', user.id)
    .in(
      'fellowship_id',
      db
        .from('fellowship_members')
        .select('fellowship_id')
        .eq('user_id', targetAlignment.user_id)
    )
    .limit(1)
    .maybeSingle()

  if (!sharedFellowship) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Atomic increment + interaction record (parallel, non-blocking) ──
  const [rpcResult] = await Promise.allSettled([
    db
      .rpc('increment_reaction', {
        p_alignment_id:  alignmentId,
        p_reaction_type: reaction,
      })
      .single(),
    db
      .from('member_spiritual_interactions')
      .insert({
        alignment_id:  alignmentId,
        interactor_id: user.id,
        action_type:   reaction,
      }),
  ])

  if (rpcResult.status === 'rejected' || !rpcResult.value?.data) {
    console.error('[react] rpc error:', rpcResult.status === 'fulfilled' ? rpcResult.value?.error?.code : 'rejected')
    return NextResponse.json({ error: 'update_failed' }, { status: 409 })
  }

  const updated = rpcResult.value.data
  return NextResponse.json({
    react_nian: updated.react_nian,
    react_amen: updated.react_amen,
  })
}
