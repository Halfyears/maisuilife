import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/accountability/checkin
// Body: { group_id, checkin_date, status, note? }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { group_id, checkin_date, status, note } = body as {
    group_id:     string
    checkin_date: string
    status:       'done' | 'missed' | 'postponed'
    note?:        string
  }

  if (!group_id || !checkin_date || !status) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!['done', 'missed', 'postponed'].includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify membership
  const { data: member } = await db
    .from('accountability_group_members')
    .select('group_id')
    .eq('group_id', group_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const { data: checkin, error } = await db
    .from('accountability_checkins')
    .upsert(
      {
        group_id,
        user_id:      user.id,
        checkin_date,
        status,
        note:         note?.trim().slice(0, 500) ?? null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'group_id,user_id,checkin_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, checkin }, { status: 201 })
}
