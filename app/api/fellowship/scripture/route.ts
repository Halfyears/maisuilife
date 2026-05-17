/**
 * POST /api/fellowship/scripture
 * Body: { ref: string }  e.g. "约翰福音 3:16" or "腓立比书 4:6-7"
 * Returns: { text: string }
 *
 * Uses Groq to retrieve the exact CUV (和合本) text.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { ref } = await req.json() as { ref?: string }
  if (!ref?.trim()) return NextResponse.json({ error: 'ref required' }, { status: 400 })

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          '你是圣经查询助手。用户给你一个圣经经文出处，你返回该经文的中文和合本原文。' +
          '只输出经文正文，不含引号、书名、章节编号，不加任何说明或前缀。' +
          '如果是多节经文，每节之间用换行分隔，节码放在每节开头括号中，如：(6) 应当一无挂虑……',
      },
      { role: 'user', content: ref.trim() },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  return NextResponse.json({ text })
}
