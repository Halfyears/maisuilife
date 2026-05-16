/**
 * Gemini 1.5 Flash — 三步关怀法属灵同行响应
 *
 * Input:  transcript (plaintext) + statusTag (单一或多选心境字符串，如"感恩、疲惫")
 * Output: { comfort, verse, verse_ref, summary }
 *
 * genAI 故意不在模块顶层初始化：
 * Next.js build 阶段执行模块代码时 GEMINI_API_KEY 为 undefined，
 * 模块级 SDK 构造函数会导致致命 build 崩溃，因此在函数内部创建。
 */
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { SCRIPTURE_BANK, AI_SUMMARY_MAX_CHARS } from '@/lib/constants'

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    comfort: {
      type: SchemaType.STRING,
      description: '150-300字三步关怀法完整回应：情感复述与认同 + 属灵智慧解读，融为一段温暖连贯的文字',
    },
    verse: {
      type: SchemaType.STRING,
      description: '经文正文（不含书卷章节，原文不改动）',
    },
    verse_ref: {
      type: SchemaType.STRING,
      description: '书卷章节引用，如"腓立比书 4:7"',
    },
    summary: {
      type: SchemaType.STRING,
      description: `${AI_SUMMARY_MAX_CHARS}字以内的祷告心声摘要（第三人称，不含任何可识别个人信息）`,
    },
  },
  required: ['comfort', 'verse', 'verse_ref', 'summary'],
}

const SYSTEM_INSTRUCTION = `你是麦穗喜乐 App 的属灵同行者，如同一位充满慈爱的属灵长辈，温柔倾听并深度回应每一位来到你面前的心灵。

你的 comfort 回应必须严格遵循【三步关怀法】，将三步内容融合为一段温暖、连贯的文字（不要生硬分段，不要标注"第一步"等字样）：

【第一步 — 情感提炼与复述】
针对用户选中的心境标签和在输入框里写下的真实文字，进行极其温柔、慈爱的复述与提炼。
例如："孩子，我听到了你内心的[疲惫与挣扎]……"或"你提到[工作的重担让你喘不过气]时，那份沉重我都看在眼里……"
帮助用户感受到被真实理解与深深接纳。绝不说教，绝不评判，只是温柔地陪伴与承接。

【第二步 — 针对性引入圣经话语】（在 verse / verse_ref 字段输出）
基于上述情感痛点，从提供的经文库中精选最能抚慰当下处境的一条。原文引用，不改动。

【第三步 — 结合处境深度解读】
必须结合用户当下真实的处境与话语，给出充满属灵智慧的深度解读，如同慈爱长辈娓娓道来，帮助用户在圣经话语中找到属于自己当下的光与力量。
严禁干瘪地罗列经文！必须建立深度的情感维系，让用户感受到这段话是专门为他/她说的。

输出规范：
- comfort：第一步 + 第三步的融合体，约150-300字，充满温度与属灵爱，语气如慈爱长辈
- verse / verse_ref：第二步选出的经文，原文不改
- summary：${AI_SUMMARY_MAX_CHARS}字以内、第三人称、绝不含任何可识别个人信息的祷告摘要

输出格式：严格遵守提供的 JSON Schema，不添加任何额外字段或解释文字。`

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
  statusTag:  string   // 接受多选心境字符串（如"感恩、疲惫"）或空字符串
}): Promise<AlignmentAIResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  // 解析多选心境标签，用于经文筛选
  const tagList = statusTag
    ? statusTag.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean)
    : []

  const candidateVerses = tagList.length > 0
    ? SCRIPTURE_BANK.filter(s => tagList.some(t => s.mood === t) || s.mood === '通用')
    : SCRIPTURE_BANK.filter(s => s.mood === '通用')
  const pool = candidateVerses.length > 0 ? candidateVerses : [...SCRIPTURE_BANK]

  const versesText = pool.map(s => `[${s.mood}] ${s.text} —— ${s.ref}`).join('\n')

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.75,
      maxOutputTokens: 900,
    },
  })

  const moodDisplay = statusTag || '未标记心境（静默交托）'
  const userPrompt = `当前心境：${moodDisplay}
用户分享（已转文字）：${transcript.slice(0, 800)}

可用经文库（从中选最贴切一条，原文不改）：
${versesText}`

  const result = await model.generateContent(userPrompt)
  const raw    = result.response.text()
  const parsed = JSON.parse(raw) as AlignmentAIResponse

  return {
    comfort:   parsed.comfort,                                  // 不截断，给足空间承载三步关怀
    verse:     parsed.verse,
    verse_ref: parsed.verse_ref,
    summary:   parsed.summary.slice(0, AI_SUMMARY_MAX_CHARS),
  }
}
