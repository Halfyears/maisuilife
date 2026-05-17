/**
 * GET /api/fellowship/insight?fellowship_id=<uuid>
 *
 * 牧养信号：读取过去 3 天组员 status_tag 分布（纯统计，无个人信息），
 * 交给 Gemini 1.5 Flash 生成 ≤100 字的氛围预备建议。
 *
 * 传入 Gemini 的数据示例（无任何个人信息）：
 *   2026-05-13: 疲惫×2, 平安×1
 *   2026-05-14: 混乱×1, 感恩×2
 *   2026-05-15: 疲惫×3, 干渴×1
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'

export interface InsightResponse {
  advice:     string   // ≤100字，给组长的氛围建议
  stats:      DayStat[]
  generated_at: string
}

interface DayStat {
  date:         string
  distribution: Record<string, number>   // { '疲惫': 2, '平安': 1 }
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

  // Verify leader
  const { data: fellowship } = await db
    .from('fellowships')
    .select('leader_id, name')
    .eq('id', fellowshipId)
    .single()

  if (!fellowship || fellowship.leader_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Fetch member IDs ───────────────────────────────────
  const { data: members } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowshipId)

  if (!members || members.length === 0) {
    return NextResponse.json<InsightResponse>({
      advice:       '团契尚无成员，待人加入后方能预备氛围。',
      stats:        [],
      generated_at: new Date().toISOString(),
    })
  }

  const memberIds = members.map((m: { user_id: string }) => m.user_id)
  const today     = new Date()
  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(today.getDate() - 2)  // today, yesterday, day before

  // ── Fetch status_tag counts (NO personal content) ─────
  // We only SELECT status_tag and date — zero individual data.
  const { data: alignments } = await db
    .from('daily_alignments')
    .select('status_tag, date')
    .in('user_id', memberIds)
    .gte('date', threeDaysAgo.toISOString().slice(0, 10))
    .eq('is_visible', true)   // respect midnight purge

  // ── Aggregate into day stats ───────────────────────────
  const statsByDate: Record<string, Record<string, number>> = {}

  ;(alignments ?? []).forEach((row: { status_tag: string; date: string }) => {
    if (!statsByDate[row.date]) statsByDate[row.date] = {}
    statsByDate[row.date][row.status_tag] = (statsByDate[row.date][row.status_tag] ?? 0) + 1
  })

  const stats: DayStat[] = Object.entries(statsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, distribution]) => ({ date, distribution }))

  // ── Build anonymous stats text for Gemini ─────────────
  const statsText = stats.length > 0
    ? stats.map(({ date, distribution }) => {
        const counts = Object.entries(distribution)
          .map(([tag, n]) => `${tag}×${n}`)
          .join('、')
        return `${date}: ${counts}`
      }).join('\n')
    : '近三天暂无状态数据'

  // ── Groq: atmosphere advice ────────────────────────────
  const prompt = [
    '你是一位经验丰富的小组长导师。',
    '基于以下组员状态分布（仅统计数字，无个人信息），',
    '请提供一段100字以内的温和建议，帮助真实的小组长预备本周的团契氛围。',
    '要求：具体可操作、温和不说教、聚焦于氛围营造而非讲道内容。',
    '严禁生成讲章或经文解释。只返回建议文字，不加标题或前缀。',
    '',
    `过去三天组员状态分布：\n${statsText}`,
  ].join('\n')

  let advice = '正在预备中，请稍候…'
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model:      'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens:  256,
    })
    advice = (completion.choices[0]?.message?.content ?? '').trim().slice(0, 100)
  } catch (err) {
    console.error('[insight] groq error:', err instanceof Error ? err.name : err)
    advice = 'AI 预备建议暂时无法生成，请稍后刷新。'
  }

  return NextResponse.json<InsightResponse>({
    advice,
    stats,
    generated_at: new Date().toISOString(),
  })
}
