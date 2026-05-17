import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/accountability/groups/join
// Body: { invite_code }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { invite_code } = await req.json()
  const code = (invite_code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 })

  const db = createServiceClient()

  const { data: group } = await db
    .from('accountability_groups')
    .select('id, name')
    .eq('invite_code', code)
    .maybeSingle()

  if (!group) return NextResponse.json({ error: 'invalid_code' }, { status: 404 })

  // Check already a member
  const { data: existing } = await db
    .from('accountability_group_members')
    .select('group_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'already_member' }, { status: 409 })

  // Fetch display name
  const { data: profile } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await db.from('accountability_group_members').insert({
    group_id:     group.id,
    user_id:      user.id,
    display_name: profile?.display_name ?? '同行者',
  })

  return NextResponse.json({ ok: true, group_id: group.id, group_name: group.name })
}
