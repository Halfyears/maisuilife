import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/accountability/groups/join
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { invite_code } = await req.json()
  const code = (invite_code ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 })

  const db = createAdminClient()

  const { data: groupData } = await db
    .from('accountability_groups')
    .select('id, name')
    .eq('invite_code', code)
    .maybeSingle()

  const group = groupData as { id: string; name: string } | null
  if (!group) return NextResponse.json({ error: 'invalid_code' }, { status: 404 })

  const { data: existing } = await db
    .from('accountability_group_members')
    .select('group_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'already_member' }, { status: 409 })

  const { data: profileData } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = (profileData as { display_name: string } | null)?.display_name ?? '同行者'

  await db.from('accountability_group_members').insert({
    group_id:     group.id,
    user_id:      user.id,
    display_name: displayName,
  })

  return NextResponse.json({ ok: true, group_id: group.id, group_name: group.name })
}
