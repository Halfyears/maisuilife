import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST /api/fellowship/accountability/checkin
// Body: { fellowship_id, checkin_date, status, note? }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fellowship_id, checkin_date, status, note } = body as {
    fellowship_id: string
    checkin_date:  string
    status:        'done' | 'missed' | 'postponed'
    note?:         string
  }

  if (!fellowship_id || !checkin_date || !status) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!['done', 'missed', 'postponed'].includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify membership
  const { data: member } = await db
    .from('fellowship_members')
    .select('fellowship_id')
    .eq('fellowship_id', fellowship_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  // Verify fellowship is accountability type
  const { data: fellowship } = await db
    .from('fellowships')
    .select('fellowship_type')
    .eq('id', fellowship_id)
    .single()

  if (!fellowship || fellowship.fellowship_type !== 'accountability') {
    return NextResponse.json({ error: 'not_accountability' }, { status: 400 })
  }

  // Upsert checkin (idempotent by unique constraint on fellowship_id, user_id, checkin_date)
  const { data: checkin, error } = await db
    .from('accountability_checkins')
    .upsert(
      {
        fellowship_id,
        user_id:      user.id,
        checkin_date,
        status,
        note:         note?.trim().slice(0, 500) ?? null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'fellowship_id,user_id,checkin_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, checkin }, { status: 201 })
}
