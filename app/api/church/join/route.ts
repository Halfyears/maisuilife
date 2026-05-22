import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/church/join
// Body: { invite_code: string }
// Joins a church (church_members) via invite code.
// Does NOT auto-join any fellowship.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { invite_code } = await req.json()
  const code = (invite_code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 })

  const db = createAdminClient()

  const { data: churchData } = await db
    .from('churches')
    .select('id, name')
    .eq('invite_code', code)
    .maybeSingle()

  if (!churchData) return NextResponse.json({ error: 'invalid_code' }, { status: 404 })

  const church = churchData as { id: string; name: string }

  const { data: existing } = await db
    .from('church_members')
    .select('church_id')
    .eq('church_id', church.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'already_member' }, { status: 409 })

  const { error: insertErr } = await db
    .from('church_members')
    .insert({ church_id: church.id, user_id: user.id })

  if (insertErr) {
    console.error('[church/join]', insertErr.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, church_id: church.id, church_name: church.name })
}
