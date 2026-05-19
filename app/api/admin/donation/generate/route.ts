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
        content: `你是一位写作者，为一款华人基督徒属灵陪伴 App（麦穗喜乐）撰写简短温暖的「请支持开发同工」邀请文字。
输出格式：严格 JSON，结构为：
{"appeals":[{"title":"…","body":"…"},{"title":"…","body":"…"},{"title":"…","body":"…"}]}
要求：
- 共3条，角度各异（如：服务器运维、持续开发、弟兄姐妹守望同行）
- title：8–14字，可用「请喝杯咖啡」「支持同工」「分担运维」等轻松表达
- body：30–50字，语气真诚轻松，说明这笔小小支持帮助 App 持续运行，绝不夸大、不施压
- 简体中文，不使用「奉献」「捐献」等宗教用语，不加任何多余字段`,
      },
      {
        role: 'user',
        content: '请为麦穗喜乐 App 生成3条不同角度的「支持开发同工」邀请短文。',
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
