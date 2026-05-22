import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/church/join-by-id
// Body: { church_id: string }
// Join a church found via search (no invite code needed — church is public).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { church_id } = await req.json()
  if (!church_id) return NextResponse.json({ error: 'missing_church_id' }, { status: 400 })

  const db = createAdminClient()

  const { data: church } = await db
    .from('churches')
    .select('id, name')
    .eq('id', church_id)
    .maybeSingle()

  if (!church) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: existing } = await db
    .from('church_members')
    .select('church_id')
    .eq('church_id', church_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'already_member' }, { status: 409 })

  const { error: insertErr } = await db
    .from('church_members')
    .insert({ church_id, user_id: user.id })

  if (insertErr) {
    console.error('[church/join-by-id]', insertErr.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    ok:          true,
    church_id:   church.id,
    church_name: church.name,
  })
}
