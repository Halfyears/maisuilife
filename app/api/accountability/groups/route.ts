import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// POST /api/accountability/groups
// Body: { name, goal_title?, goal_description?, goal_category?, schedule_days_of_week?, schedule_time?, start_date?, end_date? }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = (body.name ?? '').trim().slice(0, 100)
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const db = createServiceClient()

  // Fetch organizer display name
  const { data: profile } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  // Generate unique invite code (retry on collision)
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

  const { data: group, error } = await db
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

  if (error || !group) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // Add organizer as first member
  await db.from('accountability_group_members').insert({
    group_id:     group.id,
    user_id:      user.id,
    display_name: profile?.display_name ?? '召集人',
  })

  return NextResponse.json({ ok: true, group }, { status: 201 })
}
