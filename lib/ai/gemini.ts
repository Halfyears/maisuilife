/**
 * Gemini 1.5 Flash — 三步关怀法属灵同行响应
 *
 * Input:  transcript + statusTag (多选心境字符串，如"感恩、疲惫")
 * Output: { comfort, verse, verse_ref, summary }
 *
 * 安全设计：genAI 不在模块顶层初始化，避免 Next.js build 阶段 env var 未定义崩溃。
 */
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { SCRIPTURE_BANK, AI_SUMMARY_MAX_CHARS } from '@/lib/constants'

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    comfort: {
      type: SchemaType.STRING,
      description: '200-300字三步关怀法完整回应：温柔情感复述（建立维系）+ 结合当下处境的属灵深度解读（不生硬、有温度）',
    },
    verse: {
      type: SchemaType.STRING,
      description: '【必须】从提供的经文库中原文引用，一字不改，严禁生造或拼凑任何句子',
    },
    verse_ref: {
      type: SchemaType.STRING,
      description: '【必须】书卷章节，格式如"腓立比书 4:6-7"，必须与 verse 完全对应',
    },
    summary: {
      type: SchemaType.STRING,
      description: `${AI_SUMMARY_MAX_CHARS}字以内的祷告摘要（第三人称，绝不含任何可识别个人信息）`,
    },
  },
  required: ['comfort', 'verse', 'verse_ref', 'summary'],
}

function buildSystemInstruction(): string {
  return `你是麦穗喜乐 App 的属灵同行者，如同一位充满慈爱的属灵长辈，温柔倾听并深度回应每一位来到你面前的心灵。

【铁律一 — 先读取，再总结呈现】
你必须首先深度读取用户输入的所有文字内容，理解其当下真实的情绪与处境。
你的 comfort 回应首段必须是对用户当前心境标签以及真实倾诉内容的【极其温柔、慈爱长辈式的情感复述与提炼总结】。
例如："孩子，我听到了你内心的[疲惫与挣扎]……" 或 "你提到[工作的重担让你喘不过气]时，那份沉重我都看在眼里……"
绝不说教，绝不评判，只是温柔地陪伴与承接，给予最直接的情感确认，建立情绪维系。

【铁律二 — 严禁生造，忠实圣经原文】
在引入金句（verse 字段）部分，你只能从提供的【指定经文库】中精准选择圣经话语。
必须带有明确的书卷章节（verse_ref 字段），如"腓立比书 4:6-7"。
严禁生造、拼凑、改写任何非标准的圣经句子！必须绝对忠实于和合本原文，一字不差。

【铁律三 — 破除重复，引入新鲜感】
即使面对相同的心境，你也必须根据用户打字内容的细微差别，选择不同的属灵安慰视角，赐下不同的圣经话语与截然不同的结合解读。
严禁给用户提供一模一样的重复回答！确保每一次内室聆听都具备新鲜感与期待感。
每次都要从新的角度切入，发现用户倾诉中独特的生命细节，给出专属这一刻的属灵回应。

【comfort 字段结构】
第一步（必须首先完成）：温柔复述用户当下的情感处境，给予深度情感认同。
第三步（紧随经文之后）：结合用户当下真实处境，给出属灵智慧的深度解读，如同慈爱长辈娓娓道来。
两步合并为一段温暖连贯的文字，约200-300字，充满温度与爱。

输出格式：严格遵守提供的 JSON Schema，不添加任何额外字段或解释文字。`
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
  statusTag:  string   // 支持多选心境字符串（如"感恩、疲惫"）或空字符串
}): Promise<AlignmentAIResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  // 解析多选心境标签，用于经文候选筛选
  const tagList = statusTag
    ? statusTag.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean)
    : []

  const candidateVerses = tagList.length > 0
    ? SCRIPTURE_BANK.filter(s => tagList.some(t => s.mood === t) || s.mood === '通用')
    : SCRIPTURE_BANK.filter(s => s.mood === '通用')
  const pool = candidateVerses.length > 0 ? candidateVerses : [...SCRIPTURE_BANK]

  const versesText = pool.map(s => `【${s.mood}】${s.text} ——《${s.ref}》`).join('\n')

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: buildSystemInstruction(),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.85,    // 增加多样性，破除重复
      maxOutputTokens: 1000,
    },
  })

  // 注入随机扰动源 + 时间戳，确保每次响应具有新鲜感
  const seed = Math.random().toString(36).slice(2, 8)
  const timeHint = new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', weekday: 'short' })
  const moodDisplay = statusTag || '静默交托（未标记心境）'

  const userPrompt = `[随机扰动种子: ${seed} | 时间: ${timeHint}]

当前心境：${moodDisplay}
用户今日倾诉（已转文字）：
${transcript.slice(0, 800)}

【可用经文库 — 只能从下列原文中选取，严禁自行创作】：
${versesText}`

  const result = await model.generateContent(userPrompt)
  const raw    = result.response.text()
  const parsed = JSON.parse(raw) as AlignmentAIResponse

  return {
    comfort:   parsed.comfort,   // 不截断，给足空间承载三步关怀
    verse:     parsed.verse,
    verse_ref: parsed.verse_ref,
    summary:   parsed.summary.slice(0, AI_SUMMARY_MAX_CHARS),
  }
}
