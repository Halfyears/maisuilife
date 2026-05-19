/**
 * GET    /api/fellowship/session-plan?fellowship_id=xxx
 * PUT    /api/fellowship/session-plan   — 全量替换投屏内容（空字符串→null）
 * DELETE /api/fellowship/session-plan   — 清空投屏内容
 *        Body: { fellowship_id, theme?, scripture_ref?, scripture_text? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getAuthedUser() {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

// Normalize: treat empty / whitespace-only strings as null
function n(v: string | null | undefined): string | null {
  return v?.trim() || null
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fellowshipId = req.nextUrl.searchParams.get('fellowship_id')
  if (!fellowshipId) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

  const db = createServiceClient()
  const { data } = await db
    .from('fellowship_session_plans')
    .select('theme, scripture_ref, scripture_text, updated_at')
    .eq('fellowship_id', fellowshipId)
    .maybeSingle()

  return NextResponse.json(data ?? { theme: null, scripture_ref: null, scripture_text: null })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { fellowship_id, theme, scripture_ref, scripture_text } =
    await req.json() as {
      fellowship_id: string
      theme?: string | null
      scripture_ref?: string | null
      scripture_text?: string | null
    }
  if (!fellowship_id) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

  const db = createServiceClient()
  // Full replace: always set all three fields (empty string → null keeps projector clean)
  const { error } = await db
    .from('fellowship_session_plans')
    .upsert(
      {
        fellowship_id,
        theme:          n(theme),
        scripture_ref:  n(scripture_ref),
        scripture_text: n(scripture_text),
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'fellowship_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { fellowship_id } = await req.json() as { fellowship_id: string }
  if (!fellowship_id) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from('fellowship_session_plans')
    .upsert(
      {
        fellowship_id,
        theme:          null,
        scripture_ref:  null,
        scripture_text: null,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'fellowship_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

