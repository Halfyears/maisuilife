import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.85,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `你是一位华人基督教会的文字事工同工，为教会 App 撰写简短感人的奉献呼召短文。
输出格式：严格 JSON，结构为：
{"appeals":[{"title":"…","body":"…"},{"title":"…","body":"…"},{"title":"…","body":"…"}]}
要求：
- 共3条，各有不同主题（如：福音工作、彼此守望、肢体关怀）
- title：8–14字
- body：30–55字，语气温柔真诚，着重属灵意义，不施压、不煽情
- 简体中文，不加任何多余字段`,
      },
      {
        role: 'user',
        content: '请为麦穗喜乐华人基督教社区生成3条不同主题的奉献呼召短文。',
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(raw)
    const appeals: { title: string; body: string }[] = Array.isArray(parsed.appeals)
      ? parsed.appeals.slice(0, 3).map((a: Record<string, unknown>) => ({
          title: String(a.title ?? ''),
          body:  String(a.body  ?? ''),
        }))
      : []
    if (appeals.length === 0) throw new Error('empty')
    return NextResponse.json({ appeals })
  } catch {
    return NextResponse.json({ error: 'parse_error' }, { status: 500 })
  }
}
