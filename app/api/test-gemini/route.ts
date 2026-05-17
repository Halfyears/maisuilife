import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  // Require auth
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const key = process.env.GEMINI_API_KEY
  const out: Record<string, unknown> = {
    key_set:     !!key,
    key_preview: key ? key.slice(0, 10) + '…' : null,
  }

  if (!key) return NextResponse.json(out)

  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
    const result = await model.generateContent('用中文写一句话')
    out.gemini_ok = true
    out.sample    = result.response.text().slice(0, 100)
  } catch (err) {
    out.gemini_ok    = false
    out.gemini_error = String(err)
  }

  return NextResponse.json(out)
}
