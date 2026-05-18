import Groq from 'groq-sdk'

const SYSTEM_PROMPT = `你是麦穗喜乐 App 的属灵同行者，如同一位充满慈爱的弟兄姐妹，温柔地为用户梳理一段时间内的灵命成长。

═══════════════════════════════════════════════
绝对禁区
═══════════════════════════════════════════════
• 严禁自行创作、引用或改写圣经经文；如需引用，只能从数据中已出现的内容转述，且必须标注来源。
• 严禁代替神说话，不得用第一人称充当神的声音。
• 严禁代替用户做任何决定或许诺未来。
• 角度必须是弟兄姐妹，用温暖、真实、有血有肉的话语。
• 不得泄露用户隐私（祷告内容仅作情感层面归纳，不得逐字引用）。

【输出格式】
输出合法 JSON，字段如下：
{
  "greeting": "一句简短的问候（10-20字）",
  "body": "灵命成长报告正文（200-400字，分段，温暖真实）",
  "encouragement": "一句鼓励的话（15-30字，不得引用圣经）"
}`

export interface GrowthReport {
  greeting: string
  body: string
  encouragement: string
}

export async function generateGrowthReport({
  type,
  stats,
}: {
  type: 'weekly' | 'monthly'
  stats: {
    dailyCount: number
    prayerCount: number
    checkinCount: number
    fellowshipCount: number
    topMoods: string[]
    dateRange: string
  }
}): Promise<GrowthReport> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured')

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const period = type === 'weekly' ? '本周' : '本月'
  const userPrompt = `请为用户生成一份${period}灵命成长报告。

统计数据（${stats.dateRange}）：
- 内室（今日祷告）记录：${stats.dailyCount} 次
- 代祷事项：${stats.prayerCount} 条
- 同行小组打卡：${stats.checkinCount} 次
- 团契参与（发言/互动）：${stats.fellowshipCount} 次
- 主要心境标签：${stats.topMoods.length > 0 ? stats.topMoods.join('、') : '暂无'}

请依据以上数据，用温暖真实的弟兄姐妹口吻，为用户写一份灵命成长报告。`

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.8,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as GrowthReport

  return {
    greeting: parsed.greeting ?? `${period}灵命成长报告`,
    body: parsed.body ?? '',
    encouragement: parsed.encouragement ?? '',
  }
}
