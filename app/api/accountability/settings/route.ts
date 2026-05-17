import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// PATCH /api/accountability/settings
// Body: { group_id, name?, goal_title?, goal_description?, goal_category?,
//         schedule_days_of_week?, schedule_time?, start_date?, end_date? }
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { group_id } = body as { group_id: string }
  if (!group_id) return NextResponse.json({ error: 'missing_group_id' }, { status: 400 })

  const db = createServiceClient()

  // Only organizer can update
  const { data: group } = await db
    .from('accountability_groups')
    .select('organizer_id')
    .eq('id', group_id)
    .single()

  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (group.organizer_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const updates: Record<string, unknown> = {}
  if ('name'                  in body) updates.name                  = (body.name as string)?.trim().slice(0, 100) ?? null
  if ('goal_title'            in body) updates.goal_title            = (body.goal_title as string)?.trim().slice(0, 255) ?? null
  if ('goal_description'      in body) updates.goal_description      = (body.goal_description as string)?.trim() ?? null
  if ('goal_category'         in body) updates.goal_category         = body.goal_category ?? null
  if ('schedule_days_of_week' in body) updates.schedule_days_of_week = body.schedule_days_of_week ?? []
  if ('schedule_time'         in body) updates.schedule_time         = body.schedule_time ?? null
  if ('start_date'            in body) updates.start_date            = body.start_date ?? null
  if ('end_date'              in body) updates.end_date              = body.end_date ?? null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  }

  const { error } = await db
    .from('accountability_groups')
    .update(updates)
    .eq('id', group_id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
