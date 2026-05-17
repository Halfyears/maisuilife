/**
 * AI 属灵同行响应 — 使用 Groq (llama-3.3-70b) 实现
 * 接口与原 Gemini 版本完全一致，路由层无需改动。
 *
 * 安全设计：Groq 客户端不在模块顶层初始化，避免 build 阶段 env 未定义崩溃。
 */
import Groq from 'groq-sdk'
import { SCRIPTURE_BANK, AI_SUMMARY_MAX_CHARS } from '@/lib/constants'

function buildSystemInstruction(): string {
  return `你是麦穗喜乐 App 的属灵同行者，如同一位充满慈爱的属灵长辈，温柔倾听并深度回应每一位来到你面前的心灵。

═══════════════════════════════════════════════
铁律一 — 精准情感镜像：先逐字读取，再如实回映
═══════════════════════════════════════════════
你必须逐字读取用户的全部输入文字，识别其中的具体关键词，并将它们精准地回映在回应的开头。

✅ 正确示范：
  用户写了"仓库设计的任务压着我，睡不着觉，压力好大……"
  → comfort 首句："孩子，我听到了你说的——仓库设计的重担，还有那些辗转难眠的夜晚，那份压力是真实的，我都看在眼里……"

❌ 严禁的错误示范（空洞企业体 AI 话术）：
  "感谢你今天来到内室分享你的心声。神爱你，祂听见了你的祷告……"
  （这种开头毫无针对性，像机器模板，不被允许！）

绝不说教，绝不评判。只是温柔地陪伴、承接，给予最直接的情感确认。

═══════════════════════════════════════════════
铁律二 — 无懈可击的圣经完整性
═══════════════════════════════════════════════
• 经文（verse 字段）必须从提供的【指定经文库】中一字不改地引用和合本原文。
• verse_ref 字段必须标注精确书卷章节，格式如"腓立比书 4:6-7"。
• 严禁自行杜撰、拼凑、改写任何圣经文字。

═══════════════════════════════════════════════
铁律三 — 深度处境织入
═══════════════════════════════════════════════
comfort 结尾段落必须将所选经文与用户的具体生活处境细腻交织，如同慈爱的长辈用实际经历娓娓道来。

【输出格式要求】
必须输出合法 JSON，结构如下（不得添加其他字段）：
{
  "comfort": "200-300字三步关怀法完整回应",
  "verse": "从经文库原文引用，一字不改",
  "verse_ref": "书卷章节，如腓立比书 4:6-7",
  "summary": "${AI_SUMMARY_MAX_CHARS}字以内祷告摘要（第三人称，不含个人信息）"
}`
}

export interface AlignmentAIResponse {
  comfort:   string
  verse:     string
  verse_ref: string
  summary:   string
}

export async function generateAlignmentResponse({
  transcript,
  statusTag,
}: {
  transcript: string
  statusTag:  string
}): Promise<AlignmentAIResponse> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const tagList = statusTag
    ? statusTag.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean)
    : []

  const versesText = SCRIPTURE_BANK.map(s => {
    const matched = tagList.length === 0 || tagList.some(t => s.mood === t) || s.mood === '通用'
    const marker = matched ? '★' : '○'
    return `${marker}【${s.mood}】${s.text} ——《${s.ref}》`
  }).join('\n')

  const seed = Math.random().toString(36).slice(2, 8)
  const timeHint = new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', weekday: 'short' })
  const moodDisplay = statusTag || '静默交托（未标记心境）'

  const userPrompt = `[随机扰动种子: ${seed} | 时间: ${timeHint} | 本次必须选择与上次不同的经文]

当前心境：${moodDisplay}
用户今日倾诉：
${transcript.slice(0, 800)}

【完整经文库 — 只能从下列原文中选取，严禁自行创作】
★ 标记为与当前心境高度匹配的优先候选；○ 为次选。
${versesText}`

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: buildSystemInstruction() },
      { role: 'user',   content: userPrompt },
    ],
    model:           'llama-3.3-70b-versatile',
    temperature:     0.85,
    max_tokens:      1200,
    response_format: { type: 'json_object' },
  })

  const raw    = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as AlignmentAIResponse

  return {
    comfort:   parsed.comfort   ?? '',
    verse:     parsed.verse     ?? '',
    verse_ref: parsed.verse_ref ?? '',
    summary:   (parsed.summary  ?? '').slice(0, AI_SUMMARY_MAX_CHARS),
  }
}
