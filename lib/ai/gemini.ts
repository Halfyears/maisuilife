/**
 * Gemini 1.5 Flash — structured alignment response.
 * Input: transcript (plaintext, already STT'd) + status tag.
 * Output: { comfort, verse, summary } — never touches audio bytes.
 */
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { SCRIPTURE_BANK, AI_COMFORT_MAX_CHARS, AI_SUMMARY_MAX_CHARS } from '@/lib/constants'
import type { StatusTagValue } from '@/lib/constants'

// genAI is intentionally NOT initialised at module scope.
// Module-level SDK constructors run during the Next.js build phase where
// GEMINI_API_KEY is undefined, causing fatal build errors.
// The client is created inside generateAlignmentResponse instead.

// JSON schema enforced by Gemini's structured-output mode
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    comfort: {
      type: SchemaType.STRING,
      description: `${AI_COMFORT_MAX_CHARS}字以内的温柔回应`,
    },
    verse: {
      type: SchemaType.STRING,
      description: '经文正文（不含书卷章节）',
    },
    verse_ref: {
      type: SchemaType.STRING,
      description: '书卷章节，如"腓立比书 4:7"',
    },
    summary: {
      type: SchemaType.STRING,
      description: `${AI_SUMMARY_MAX_CHARS}字以内的交托摘要（第三人称，无个人信息）`,
    },
  },
  required: ['comfort', 'verse', 'verse_ref', 'summary'],
}

const SYSTEM_INSTRUCTION = `你是麦穗喜乐 App 的属灵同行者，温柔、简洁、不说教。
你的职责：
1. comfort — 对分享者当下心境给予${AI_COMFORT_MAX_CHARS}字以内的回应，承接情绪而非评判
2. verse / verse_ref — 从提供的经文库中选出最贴切的一条，原文引用，不改动
3. summary — 用${AI_SUMMARY_MAX_CHARS}字以内、第三人称，将此次祷告心声提炼为交托摘要；
   绝不包含任何可识别个人信息，不出现姓名、地名、机构名

输出格式：严格遵守提供的 JSON Schema，不添加任何额外字段或解释文字。`

export interface AlignmentAIResponse {
  comfort: string
  verse: string
  verse_ref: string
  summary: string
}

export async function generateAlignmentResponse({
  transcript,
  statusTag,
}: {
  transcript: string
  statusTag: StatusTagValue
}): Promise<AlignmentAIResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  // Filter scriptures relevant to this mood + universal ones
  const candidateVerses = SCRIPTURE_BANK.filter(
    (s) => s.mood === statusTag || s.mood === '通用'
  )

  const versesText = candidateVerses
    .map((s) => `[${s.mood}] ${s.text} —— ${s.ref}`)
    .join('\n')

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
      maxOutputTokens: 512,
    },
  })

  const userPrompt = `当前心境：${statusTag}
分享内容（已转文字）：${transcript.slice(0, 800)}

可用经文库（从中选最贴切一条）：
${versesText}`

  const result = await model.generateContent(userPrompt)
  const raw = result.response.text()

  const parsed = JSON.parse(raw) as AlignmentAIResponse

  // Safety caps — structured output should already comply, but guard anyway
  return {
    comfort:   parsed.comfort.slice(0, AI_COMFORT_MAX_CHARS),
    verse:     parsed.verse,
    verse_ref: parsed.verse_ref,
    summary:   parsed.summary.slice(0, AI_SUMMARY_MAX_CHARS),
  }
}
