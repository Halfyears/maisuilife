import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// PATCH /api/fellowship/accountability/setup
// Body: { fellowship_id, fellowship_type, goal_title, goal_description, goal_category,
//         goal_start_date, goal_end_date, schedule_days_of_week, schedule_time }
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fellowship_id } = body as { fellowship_id: string }
  if (!fellowship_id) return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })

  const db = createServiceClient()

  // Verify leader or admin role
  const { data: profile } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: fellowship } = await db
    .from('fellowships')
    .select('leader_id')
    .eq('id', fellowship_id)
    .single()

  const isLeader = fellowship?.leader_id === user.id
  const isAdmin  = ['church_admin', 'super_admin'].includes(profile?.role ?? '')

  if (!isLeader && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}

  if ('fellowship_type' in body) updates.fellowship_type = body.fellowship_type
  if ('goal_title'       in body) updates.goal_title       = (body.goal_title as string)?.trim().slice(0, 255) ?? null
  if ('goal_description' in body) updates.goal_description = (body.goal_description as string)?.trim() ?? null
  if ('goal_category'    in body) updates.goal_category    = body.goal_category ?? null
  if ('goal_start_date'  in body) updates.goal_start_date  = body.goal_start_date ?? null
  if ('goal_end_date'    in body) updates.goal_end_date     = body.goal_end_date ?? null
  if ('schedule_days_of_week' in body) updates.schedule_days_of_week = body.schedule_days_of_week ?? []
  if ('schedule_time'    in body) updates.schedule_time    = body.schedule_time ?? null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  }

  const { error } = await db
    .from('fellowships')
    .update(updates)
    .eq('id', fellowship_id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
