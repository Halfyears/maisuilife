import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// POST /api/accountability/groups
export async function POST(req: NextRequest) {
  // 1. Verify auth via cookie client
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = (body.name ?? '').trim().slice(0, 100)
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  // 2. Use direct admin client (no cookie dependency)
  const db = createAdminClient()

  // 3. Check table exists before anything else
  const { error: tableErr } = await db
    .from('accountability_groups')
    .select('id')
    .limit(0)

  if (tableErr) {
    console.error('[accountability/groups] table check failed:', tableErr.message)
    return NextResponse.json({
      error:   'setup_required',
      message: `数据库表未初始化，请在 Supabase SQL 编辑器运行 014_accountability_groups.sql（${tableErr.message}）`,
    }, { status: 500 })
  }

  // 4. Fetch display name
  const { data: profileData } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = (profileData as { display_name: string } | null)?.display_name ?? '召集人'

  // 5. Generate unique invite code
  let invite_code = generateInviteCode()
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await db
      .from('accountability_groups')
      .select('id')
      .eq('invite_code', invite_code)
      .maybeSingle()
    if (!existing) break
    invite_code = generateInviteCode()
  }

  // 6. Insert group
  const { data: groupData, error: insertErr } = await db
    .from('accountability_groups')
    .insert({
      name,
      organizer_id:          user.id,
      invite_code,
      goal_title:            body.goal_title?.trim().slice(0, 255) ?? null,
      goal_description:      body.goal_description?.trim() ?? null,
      goal_category:         body.goal_category ?? 'custom',
      schedule_days_of_week: body.schedule_days_of_week ?? [],
      schedule_time:         body.schedule_time ?? null,
      start_date:            body.start_date ?? null,
      end_date:              body.end_date ?? null,
    })
    .select()
    .single()

  if (insertErr || !groupData) {
    console.error('[accountability/groups] insert error:', insertErr?.message)
    return NextResponse.json({
      error:   'db_error',
      message: insertErr?.message ?? 'insert failed',
    }, { status: 500 })
  }

  const group = groupData as { id: string; invite_code: string; name: string }

  // 7. Add organizer as first member
  const { error: memberErr } = await db
    .from('accountability_group_members')
    .insert({
      group_id:     group.id,
      user_id:      user.id,
      display_name: displayName,
    })

  if (memberErr) {
    console.error('[accountability/groups] member insert error:', memberErr.message)
  }

  return NextResponse.json({ ok: true, group: groupData }, { status: 201 })
}
