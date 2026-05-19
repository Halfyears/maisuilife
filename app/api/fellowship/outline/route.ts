/**
 * POST /api/fellowship/outline
 *
 * AI 生成团契聚会备课大纲（组长专用）
 * 三条钢印 Prompt 严格约束：三维结构 · 总分总骨架 · 3000-4500字精准时控
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export const runtime     = 'nodejs'
export const maxDuration = 120   // two Groq calls worst case

interface OutlineRequest {
  fellowship_id: string
  meeting_type:  'theme' | 'scripture'   // 主题 | 经文
  input_query:   string                  // e.g. "职场诚实" 或 "罗马书8章"
}

export type OutlineTier = 'free' | 'premium'

export interface MeetingOutline {
  meeting_type:  'theme' | 'scripture'
  input_query:   string
  tier:          OutlineTier            // 'free' = 简版纲要 | 'premium' = 完整讲章
  ai_member_insight: {
    problem_summary: string
    bible_framework: string
  }
  ai_sermon_lecture: {
    scripture_ref:          string    // 经文章节，如"腓立比书 4:13"
    scripture_text_full:    string    // 和合本原段落
    theological_breakdown:  string[]
    application_questions:  string[]
  }
  generated_at:    string
  from_cache?:     boolean   // true = 从共享库命中，未消耗 token
  cache_use_count?: number   // 跨团契调用次数（含本次）
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
【钢印三：精准字数，每段硬性下限】
═══════════════════════════════════════════
普通话宣讲语速约 100 字/分钟。五段合计必须达到 3000-4500 字。
以下是每段的硬性最低字数，达不到就是任务失败：
  引言：最少 500 字
  论点一：最少 700 字
  论点二：最少 700 字
  论点三：最少 700 字
  结论呼召：最少 400 字
  ─────────────────────────
  五段合计：最少 3000 字

如何写满字数：
• 每处圣经引用后，用 2-3 句话展开解释这句话的神学含义
• 每个现实场景要有细节：写出人物、情境、心理活动，而不只是一句概括
• 每个属灵解法要有操作步骤：具体到这周能做什么，而不只是"要信靠神"
• 段落之间要有过渡句，讲章有连贯的叙事节奏

═══════════════════════════════════════════
【输出格式要求】
═══════════════════════════════════════════
必须输出合法 JSON，严格遵守以下结构（不得添加其他字段）：
{
  "problem_summary": "150字以内，匿名总结本周团契成员内室状态的共同处境，第三人称，不含任何个人信息",
  "bible_framework": "200字以内，用圣经神学语言对该主题/经文进行属灵定性，点明核心属灵张力",
  "scripture_ref": "经文章节引用，格式如：腓立比书 4:13 或 罗马书 8:1-4",
  "scripture_text_full": "和合本圣经原文段落，主题模式下选最相关的核心经段，经文模式下输出指定章节全文",
  "theological_breakdown": [
    "【引言 · 最少500字】真实生活场景开场 → 引出核心属灵张力 → 预告三大论点",
    "【论点一：标题 · 最少700字】圣经经文原文 → 神学解释2-3句 → 具体职场/家庭场景细节 → 属灵解法+本周可执行行动",
    "【论点二：标题 · 最少700字】圣经经文原文 → 神学解释2-3句 → 具体职场/家庭场景细节 → 属灵解法+本周可执行行动",
    "【论点三：标题 · 最少700字】圣经经文原文 → 神学解释2-3句 → 具体职场/家庭场景细节 → 属灵解法+本周可执行行动",
    "【结论呼召 · 最少400字】三点总结 → 具体委身行动 → 祷告感收尾"
  ],
  "application_questions": [
    "第一个震撼问题（直接戳到现实痛点，让人无法回避）",
    "第二个震撼问题（帮助成员把圣经真理落地到本周具体处境）",
    "第三个震撼问题（呼召具体行动或委身的问题）"
  ]
}`
}

/**
 * 免费版 Prompt — 仅生成简版纲要，每段 1-2 句，合计 600-800 字
 * 足以让组长理解结构，不提供可直接宣讲的完整内容
 */
function buildFreeSystemPrompt(): string {
  return `你是麦穗喜乐团契的备课助手，为团契组长生成聚会讲章的简版纲要。

【输出要求】
theological_breakdown 必须包含 5 个元素（引言/论点一/论点二/论点三/结论呼召），
每个元素只写 2-3 句话，点明核心真理和关键经文即可，不展开论述。
五段合计控制在 600-800 字以内。

【JSON 输出格式】
{
  "problem_summary": "100字以内，简述本周团契成员共同处境",
  "bible_framework": "100字以内，该主题/经文的核心属灵张力",
  "scripture_ref": "经文章节，如：腓立比书 4:13",
  "scripture_text_full": "和合本原文，主题模式取最相关1-2节，经文模式取指定段落",
  "theological_breakdown": [
    "【引言 · 简版】一句开场，引出主题张力",
    "【论点一：标题】核心经文 + 一句应用",
    "【论点二：标题】核心经文 + 一句应用",
    "【论点三：标题】核心经文 + 一句应用",
    "【结论】一句总结 + 一句呼召"
  ],
  "application_questions": [
    "第一个讨论问题",
    "第二个讨论问题",
    "第三个讨论问题"
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

  // ── Tier: premium only for super_admin (for now) ────────────────────────
  // Future: check fellowship/user subscription here
  const tier: 'free' | 'premium' = role === 'super_admin' ? 'premium' : 'free'

  // ── Shared cache lookup (cross-fellowship, zero-token fast path) ─────────
  const queryNormalized = input_query.trim().toLowerCase().replace(/\s+/g, ' ')

  const { data: cached } = await db
    .from('shared_outlines')
    .select('id, outline, use_count')
    .eq('meeting_type', meeting_type)
    .eq('query_normalized', queryNormalized)
    .eq('tier', tier)
    .maybeSingle()

  if (cached) {
    const newCount = (cached.use_count as number) + 1
    const cachedOutline: MeetingOutline = {
      ...(cached.outline as MeetingOutline),
      generated_at:    new Date().toISOString(),
      from_cache:      true,
      cache_use_count: newCount,
    }
    // Atomic increment (fire-and-forget)
    db.rpc('increment_shared_use_count', { p_id: cached.id })
      .then(({ error: e }) => { if (e) console.error('[outline] use_count increment failed', e.message) })

    // Save to fellowship history (fire-and-forget)
    db.from('fellowship_outlines').insert({
      fellowship_id, created_by: user.id,
      meeting_type, input_query, tier,
      outline:      cachedOutline as unknown as Record<string, unknown>,
      generated_at: cachedOutline.generated_at,
    }).then(({ error: e }) => { if (e) console.error('[outline] fellowship history save failed', e.message) })

    return NextResponse.json(cachedOutline)
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

  const userPrompt = tier === 'premium'
    ? `【本次备课任务】
类型：${typeLabel}
${typeHint}

【团契本周内室状态（匿名统计）】
${moodContext}

重要提醒：theological_breakdown 五段合计必须达到 3000 字以上。
每段的硬性下限：引言≥500字，三个论点各≥700字，结论≥400字。
用具体细节、场景描写、操作步骤来填满字数，绝不允许概括性带过。`
    : `【本次备课任务】
类型：${typeLabel}
${typeHint}

【团契本周内室状态（匿名统计）】
${moodContext}`

  // ── Call Groq ──────────────────────────────────────────────────────────
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  // Premium: full 3000-char sermon · Free: concise 600-800-char outline
  const systemPrompt = tier === 'premium' ? buildSystemPrompt() : buildFreeSystemPrompt()
  const maxTok       = tier === 'premium' ? 8000 : 2000

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    model:           'llama-3.3-70b-versatile',
    temperature:     0.75,
    max_tokens:      maxTok,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'ai_parse_error' }, { status: 500 })
  }

  let breakdown: string[] = Array.isArray(parsed.theological_breakdown)
    ? (parsed.theological_breakdown as unknown[]).map(String)
    : []

  // ── 字数兜底：仅 premium 版触发（免费版不扩写）──────────────────────────
  if (tier === 'premium') {
    const totalChars = breakdown.reduce((s, t) => s + t.length, 0)
    if (totalChars < 2500 && breakdown.length === 5) {
      console.warn(`[outline] sermon too short (${totalChars} chars), triggering expansion`)

      const sectionLabels = ['引言（目标≥500字）', '论点一（目标≥700字）', '论点二（目标≥700字）', '论点三（目标≥700字）', '结论呼召（目标≥400字）']
      const expandPrompt = `以下是你刚生成的讲章各段，字数严重不足（合计仅${totalChars}字，目标3000字）。
请对每一段进行大幅扩写，加入更多圣经解释、具体生活场景细节、和属灵操作步骤。
必须以 JSON 数组格式输出，只输出 theological_breakdown 数组，共 5 个字符串元素。

当前各段：
${breakdown.map((s, i) => `[${i}] ${sectionLabels[i]}（当前${s.length}字）：${s.slice(0, 80)}…`).join('\n')}

请重写并大幅扩展每段。格式：{"theological_breakdown": ["扩写后的引言", "扩写后的论点一", "扩写后的论点二", "扩写后的论点三", "扩写后的结论"]}`

      try {
        const expansion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
            { role: 'assistant', content: raw },
            { role: 'user',   content: expandPrompt },
          ],
          model:           'llama-3.3-70b-versatile',
          temperature:     0.7,
          max_tokens:      8000,
          response_format: { type: 'json_object' },
        })
        const raw2 = expansion.choices[0]?.message?.content ?? '{}'
        const parsed2 = JSON.parse(raw2) as Record<string, unknown>
        if (Array.isArray(parsed2.theological_breakdown)) {
          const expanded = (parsed2.theological_breakdown as unknown[]).map(String)
          const expandedTotal = expanded.reduce((s, t) => s + t.length, 0)
          if (expandedTotal > totalChars) breakdown = expanded
        }
      } catch (e) {
        console.error('[outline] expansion call failed', e)
      }
    }
  }

  const outline: MeetingOutline = {
    meeting_type,
    input_query,
    tier,
    ai_member_insight: {
      problem_summary: String(parsed.problem_summary ?? ''),
      bible_framework:  String(parsed.bible_framework  ?? ''),
    },
    ai_sermon_lecture: {
      scripture_ref:         String(parsed.scripture_ref        ?? (meeting_type === 'scripture' ? input_query : '')),
      scripture_text_full:   String(parsed.scripture_text_full  ?? ''),
      theological_breakdown: breakdown,
      application_questions: Array.isArray(parsed.application_questions)
        ? (parsed.application_questions as unknown[]).map(String).slice(0, 3)
        : [],
    },
    generated_at: new Date().toISOString(),
  }

  // ── Save to shared cache (insert only — keep the first version if already exists) ─
  db.from('shared_outlines').upsert({
    meeting_type,
    input_query,
    query_normalized: queryNormalized,
    tier,
    outline:          outline as unknown as Record<string, unknown>,
    use_count:        1,
    generated_at:     outline.generated_at,
    last_used_at:     outline.generated_at,
  }, { onConflict: 'meeting_type,query_normalized,tier', ignoreDuplicates: true })
  .then(({ error: e }) => { if (e) console.error('[outline] shared cache save failed', e.message) })

  // ── Save to fellowship history ───────────────────────────────────────────
  db.from('fellowship_outlines').insert({
    fellowship_id,
    created_by:   user.id,
    meeting_type,
    input_query,
    tier,
    outline:      outline as unknown as Record<string, unknown>,
    generated_at: outline.generated_at,
  }).then(({ error: saveErr }) => {
    if (saveErr) console.error('[outline] fellowship history save failed', saveErr.message)
  })

  return NextResponse.json(outline)
}
