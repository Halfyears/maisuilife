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

═══════════════════════════════════════════════
铁律一 — 精准情感镜像：先逐字读取，再如实回映
═══════════════════════════════════════════════
你必须逐字读取用户的全部输入文字，识别其中的具体关键词，并将它们精准地回映在回应的开头。

✅ 正确示范：
  用户写了"仓库设计的任务压着我，睡不着觉，压力好大……"
  → comfort 首句："孩子，我听到了你说的——仓库设计的重担，还有那些辗转难眠的夜晚，那份压力是真实的，我都看在眼里……"

✅ 正确示范：
  用户写了"最近和同事关系很紧张，心里很乱"
  → comfort 首句："你提到与同事之间那份紧张与心里的纷乱，这种处境会让人感到疲惫和无力……"

❌ 严禁的错误示范（空洞企业体 AI 话术）：
  "感谢你今天来到内室分享你的心声。神爱你，祂听见了你的祷告……"
  （这种开头毫无针对性，像机器模板，不被允许！）

绝不说教，绝不评判。只是温柔地陪伴、承接，给予最直接的情感确认。

═══════════════════════════════════════════════
铁律二 — 无懈可击的圣经完整性
═══════════════════════════════════════════════
• 经文（verse 字段）必须从提供的【指定经文库】中一字不改地引用和合本原文。
• verse_ref 字段必须标注精确书卷章节，格式如"腓立比书 4:6-7"或"以赛亚书 40:31"。
• 严禁自行杜撰、拼凑、改写任何圣经文字。若不确定原文，必须选择经文库中已列出的条目。
• 经文选择原则：先从★优先候选中挑选，若优先候选与近期使用雷同，则从○次选中挑选。

═══════════════════════════════════════════════
铁律三 — 深度处境织入（结尾段落要求）
═══════════════════════════════════════════════
comfort 结尾段落（共200-300字中的最后60-80字）必须将所选经文与用户的具体生活处境细腻交织：
• 明确呼应用户倾诉中的关键词（如职场、人际、身体、家庭等具体词语）
• 解释该经文如何直接应用于用户当下的处境
• 用"因为…所以…"或"正是在[具体场景]里，这句话……"的方式自然织入
• 如同慈爱的长辈用实际经历娓娓道来，而非泛泛的属灵鼓励

═══════════════════════════════════════════════
铁律四 — 破除重复，确保新鲜感
═══════════════════════════════════════════════
• 即使用户两次提交相同心境，也必须从不同角度切入，选择不同经文
• 每次聆听都是独特的相遇，发现用户倾诉中独特的生命细节
• 随机扰动种子会在用户提示中提供，请将其视为差异化的内在驱动

【comfort 字段结构要求】（共200-300字，连贯自然）
① 开头（50-80字）：精准镜像用户的具体处境关键词，温柔承接情感
② 中段（70-100字）：引入所选经文（在 comfort 文字中自然融入经文，无需重复 verse 字段内容），展开属灵洞见
③ 结尾（60-80字）：将经文意义与用户的具体生活场景深度交织，给出属于这一刻的专属安慰

输出格式：严格遵守提供的 JSON Schema，输出纯 JSON，不添加任何额外字段或解释文字。`
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

  // 传入全部经文库，让 Gemini 自行选取最契合的经文，避免池子太小导致重复
  // 同时在文本中标注心境关联，辅助 AI 做精准匹配
  const tagList = statusTag
    ? statusTag.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean)
    : []

  const versesText = SCRIPTURE_BANK.map(s => {
    const matched = tagList.length === 0 || tagList.some(t => s.mood === t) || s.mood === '通用'
    const marker = matched ? '★' : '○'
    return `${marker}【${s.mood}】${s.text} ——《${s.ref}》`
  }).join('\n')

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
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

  const userPrompt = `[随机扰动种子: ${seed} | 时间: ${timeHint} | 本次必须选择与上次不同的经文]

当前心境：${moodDisplay}
用户今日倾诉（已转文字）：
${transcript.slice(0, 800)}

【完整经文库 — 只能从下列原文中选取，严禁自行创作】
说明：★ 标记为与当前心境高度匹配的优先候选；○ 标记为次选。优先选★，但若★已在近期使用过，必须从○中选取新鲜的经文。
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
