import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const key = process.env.GROQ_API_KEY
  const out: Record<string, unknown> = {
    key_set:     !!key,
    key_preview: key ? key.slice(0, 10) + '…' : null,
  }

  if (!key) return NextResponse.json(out)

  try {
    const groq = new Groq({ apiKey: key })
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: '用中文写一句话' }],
      model:     'llama-3.3-70b-versatile',
      max_tokens: 50,
    })
    out.groq_ok = true
    out.model   = 'llama-3.3-70b-versatile'
    out.sample  = completion.choices[0]?.message?.content?.slice(0, 100)
  } catch (err) {
    out.groq_ok    = false
    out.groq_error = String(err)
  }

  return NextResponse.json(out)
}
