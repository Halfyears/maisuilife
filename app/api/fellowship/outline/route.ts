/**
 * POST /api/fellowship/outline
 *
 * AI 生成团契聚会备课大纲（组长专用）
 * 三条钢印 Prompt 严格约束：三维结构 · 总分总骨架 · 3000-4500字精准时控
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export const runtime   = 'nodejs'
export const maxDuration = 60

interface OutlineRequest {
  fellowship_id: string
  meeting_type:  'theme' | 'scripture'   // 主题 | 经文
  input_query:   string                  // e.g. "职场诚实" 或 "罗马书8章"
}

export interface MeetingOutline {
  meeting_type:  'theme' | 'scripture'
  input_query:   string
  ai_member_insight: {
    problem_summary: string   // 5 分钟：本周团契内室状态匿名总结
    bible_framework: string   // 5 分钟：圣经对该问题的属灵定性
  }
  ai_sermon_lecture: {
    scripture_text_full:    string    // 和合本原段落
    theological_breakdown:  string[]  // 30-45 分钟阐述（分段数组）
    application_questions:  string[]  // 3个交通问题
  }
  generated_at: string
}

function buildSystemPrompt(): string {
  return `你是麦穗喜乐团契的属灵备课助手，专门帮助团契组长准备聚会查经材料。
你的受众是普通信徒组长——他们不是神学院学生，但渴望带领好每一次聚会。

═══════════════════════════════════════════
【钢印一：三维结构，绝对禁绝空话】
═══════════════════════════════════════════
theological_breakdown 的每一个阐述段落，必须严格遵守以下三维结构：
  ① 圣经  → 先引出具体和合本经文原文（带书卷章节）
  ② 现实  → 立即连接真实生活处境：货运压力、仓储重担、职场博弈、家庭关系、养育挑战
            要有画面感：写出具体场景，让坐在台下的弟兄姐妹听到"就是在说我"
  ③ 属灵  → 给出明确的属灵解法：不是心灵鸡汤，是有圣经根基的信仰行动
            结尾要有呼召感，让人听完有力量站起来去做

空话举例（严禁出现）：
  ❌ "神爱你，所以你要相信祂" （没有经文、没有处境、没有行动）
  ❌ "我们要学习信靠神"（空洞口号，无三维结构）

═══════════════════════════════════════════
【钢印二：总-分-总讲章骨架，逻辑严密】
═══════════════════════════════════════════
theological_breakdown 数组必须包含以下 5 个元素，按顺序输出：
  [0] 引言      — 以一个真实生活场景开场，引发共鸣，提出核心张力
  [1] 论点一    — 第一大真理（圣经→现实→属灵）
  [2] 论点二    — 第二大真理（圣经→现实→属灵）
  [3] 论点三    — 第三大真理（圣经→现实→属灵）
  [4] 结论呼召  — 总结三点，发出具体行动呼召，以祷告感的语言收尾

每个论点必须有小标题，格式如：「论点一：[标题]」

═══════════════════════════════════════════
【钢印三：精准时控，3000-4500 字】
═══════════════════════════════════════════
theological_breakdown 五段合计总字数必须在 3000-4500 字之间。
（正常普通话宣讲语速约 100 字/分钟，3000字=30分钟，4500字=45分钟）
宁可在细节处展开，也不要缩水。每段都要充实饱满。

═══════════════════════════════════════════
【输出格式要求】
═══════════════════════════════════════════
必须输出合法 JSON，严格遵守以下结构（不得添加其他字段）：
{
  "problem_summary": "150字以内，匿名总结本周团契成员内室状态的共同处境，第三人称，不含任何个人信息",
  "bible_framework": "200字以内，用圣经神学语言对该主题/经文进行属灵定性，点明核心属灵张力",
  "scripture_text_full": "和合本圣经原文段落，主题模式下选最相关的核心经段，经文模式下输出指定章节全文",
  "theological_breakdown": [
    "引言段（约500字）：真实场景开场，提出核心张力",
    "论点一：[标题]（约700字）：三维结构展开",
    "论点二：[标题]（约700字）：三维结构展开",
    "论点三：[标题]（约700字）：三维结构展开",
    "结论呼召（约400字）：总结+行动呼召+祷告收尾"
  ],
  "application_questions": [
    "第一个震撼问题（直接戳到现实痛点，让人无法回避）",
    "第二个震撼问题（帮助成员把圣经真理落地到本周具体处境）",
    "第三个震撼问题（呼召具体行动或委身的问题）"
  ]
}`
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Partial<OutlineRequest>
  const { fellowship_id, meeting_type, input_query } = body

  if (!fellowship_id || !meeting_type || !input_query?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!['theme', 'scripture'].includes(meeting_type)) {
    return NextResponse.json({ error: 'invalid_meeting_type' }, { status: 400 })
  }
  if (input_query.length > 200) {
    return NextResponse.json({ error: 'query_too_long' }, { status: 400 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'ai_not_configured' }, { status: 503 })
  }

  const db = createAdminClient()

  // ── Auth: group_leader of this fellowship, or privileged admin ──────────
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isPrivileged = ['church_admin', 'super_admin'].includes(role)

  if (!isPrivileged) {
    if (role !== 'group_leader') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { data: f } = await db
      .from('fellowships').select('id').eq('id', fellowship_id).eq('leader_id', user.id).maybeSingle()
    if (!f) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Fetch anonymous member mood context (last 7 days) ──────────────────
  const { data: members } = await db
    .from('fellowship_members').select('user_id').eq('fellowship_id', fellowship_id)
  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)

  let moodContext = '（本周暂无成员内室记录）'
  if (memberIds.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const { data: alignments } = await db
      .from('daily_alignments')
      .select('status_tag')
      .in('user_id', memberIds)
      .gte('date', sevenDaysAgo)
      .eq('is_visible', true)

    const tagCounts: Record<string, number> = {}
    ;(alignments ?? []).forEach((a: { status_tag: string }) => {
      if (!a.status_tag) return
      a.status_tag.split(/[、,，]+/).map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1
      })
    })

    const totalRecords = alignments?.length ?? 0
    if (totalRecords > 0) {
      const topTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => `${tag}(${count}人)`)
        .join('、')
      moodContext = `本周共 ${totalRecords} 份内室记录，主要心境关键词：${topTags || '未标记'}`
    }
  }

  // ── Build user prompt ───────────────────────────────────────────────────
  const typeLabel = meeting_type === 'theme' ? '主题查经' : '经文查经'
  const typeHint  = meeting_type === 'theme'
    ? `主题：「${input_query}」\n请自动选取最能支撑该主题的和合本核心经段（1-3节），放入 scripture_text_full。`
    : `经文段落：「${input_query}」\n请输出该段落的和合本完整原文于 scripture_text_full。`

  const userPrompt = `【本次备课任务】
类型：${typeLabel}
${typeHint}

【团契本周内室状态（匿名统计）】
${moodContext}

请严格按照系统指令中的三条钢印要求生成完整备课大纲。
theological_breakdown 五段合计必须达到 3000-4500 字，不得缩水。`

  // ── Call Groq ───────────────────────────────────────────────────────────
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: userPrompt },
    ],
    model:           'llama-3.3-70b-versatile',
    temperature:     0.75,
    max_tokens:      6000,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'ai_parse_error' }, { status: 500 })
  }

  const outline: MeetingOutline = {
    meeting_type,
    input_query,
    ai_member_insight: {
      problem_summary: String(parsed.problem_summary ?? ''),
      bible_framework:  String(parsed.bible_framework  ?? ''),
    },
    ai_sermon_lecture: {
      scripture_text_full:   String(parsed.scripture_text_full ?? ''),
      theological_breakdown: Array.isArray(parsed.theological_breakdown)
        ? (parsed.theological_breakdown as unknown[]).map(String)
        : [],
      application_questions: Array.isArray(parsed.application_questions)
        ? (parsed.application_questions as unknown[]).map(String).slice(0, 3)
        : [],
    },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(outline)
}
