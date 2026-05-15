/**
 * GET /api/admin/stats
 *
 * 管理中枢实时统计：
 *  - 用户总数 / 今日对齐数
 *  - 本月计费对齐数 → 预估 Gemini + Whisper 费用
 *  - 全网今日属灵天气（status_tag 分布）
 *  - AI 熔断器当前状态
 *
 * 仅 super_admin 可访问。service_role 绕开 RLS。
 */

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export interface AdminStats {
  users_total:         number
  alignments_today:    number
  // Cost estimation
  billable_this_month: number
  cost_gemini_usd:     number
  cost_whisper_usd:    number
  cost_total_usd:      number
  // Spiritual weather
  weather: { status_tag: string; count: number; pct: number }[]
  // System state
  ai_active:  boolean
  generated_at: string
}

// Per-alignment cost estimates (see migration 006 for rationale)
const GEMINI_PER_ALIGNMENT  = 0.0002   // USD
const WHISPER_PER_ALIGNMENT = 0.0013   // USD

export async function GET() {
  // ── Auth + super_admin guard ───────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: profile } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Parallel data fetch ────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'   // e.g. "2026-05-01"

  const [
    usersRes,
    todayRes,
    monthlyRes,
    weatherRes,
    circuitRes,
  ] = await Promise.all([
    // Total registered users
    db.from('users').select('id', { count: 'exact', head: true }),

    // Today's alignments
    db.from('daily_alignments')
      .select('id', { count: 'exact', head: true })
      .eq('date', today),

    // This month's billable (non-silent) alignments
    db.from('daily_alignments')
      .select('id', { count: 'exact', head: true })
      .gte('date', monthStart)
      .eq('is_silent', false),

    // Spiritual weather
    db.from('admin_spiritual_weather')
      .select('status_tag, count, pct'),

    // AI circuit breaker status
    db.from('system_configs')
      .select('value')
      .eq('key', 'ai_circuit_breaker')
      .single(),
  ])

  const billable = monthlyRes.count ?? 0
  const geminiCost  = billable * GEMINI_PER_ALIGNMENT
  const whisperCost = billable * WHISPER_PER_ALIGNMENT

  return NextResponse.json<AdminStats>({
    users_total:         usersRes.count   ?? 0,
    alignments_today:    todayRes.count   ?? 0,
    billable_this_month: billable,
    cost_gemini_usd:     geminiCost,
    cost_whisper_usd:    whisperCost,
    cost_total_usd:      geminiCost + whisperCost,
    weather:             (weatherRes.data ?? []) as AdminStats['weather'],
    ai_active:           circuitRes.data?.value?.active ?? true,
    generated_at:        new Date().toISOString(),
  })
}
