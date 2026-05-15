/**
 * POST /api/fellowship/silent
 *
 * 静默交账：用户无语音分享，但以默默同行姿态解锁今日团契视野。
 * 插入一条 is_silent=TRUE 的 daily_alignments 记录（无摘要、无音频）。
 * 这条记录在午夜同样会被洗净（is_visible→FALSE）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const fellowshipId: string | undefined = body.fellowship_id
  if (!fellowshipId) {
    return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })
  }

  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // ── Verify membership ────────────────────────────────
  const { data: membership } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowshipId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Guard: already submitted today ───────────────────
  const { data: existing } = await db
    .from('daily_alignments')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  if (existing) {
    // Already submitted (voice or silent) — not an error, just idempotent
    return NextResponse.json({ success: true, already_exists: true })
  }

  // ── Insert silent alignment ───────────────────────────
  // is_silent=TRUE  → ai_summary_enc stays NULL (enforced by DB constraint)
  // status_tag='平安' → neutral default for silent entries
  const { error: insertErr } = await db
    .from('daily_alignments')
    .insert({
      user_id:        user.id,
      status_tag:     '平安',
      theme_tags:     [],
      ai_summary_enc: null,
      is_silent:      true,
      is_visible:     true,
      date:           today,
    })

  if (insertErr) {
    console.error('[silent] insert error:', insertErr.code)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
