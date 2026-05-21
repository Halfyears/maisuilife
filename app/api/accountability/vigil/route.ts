import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { todayLocal } from '@/lib/date'

export const runtime = 'nodejs'

// POST /api/accountability/vigil
// Body: { group_id: string, note?: string }
// Upserts a presence record for today, returns updated today_presences list.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { group_id, note } = await req.json() as { group_id?: string; note?: string }
  if (!group_id) return NextResponse.json({ error: 'missing_group_id' }, { status: 400 })

  const db = createAdminClient()

  // Verify membership
  const { data: member } = await db
    .from('accountability_group_members')
    .select('display_name')
    .eq('group_id', group_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const today = todayLocal()
  const cleanNote = (note ?? '').trim().slice(0, 100) || null

  const { error: upsertErr } = await db
    .from('accountability_vigil_presences')
    .upsert(
      { group_id, user_id: user.id, presence_date: today, note: cleanNote },
      { onConflict: 'group_id,user_id,presence_date' },
    )

  if (upsertErr) {
    console.error('[vigil] upsert error:', upsertErr.message)
    return NextResponse.json({ error: 'db_error', message: upsertErr.message }, { status: 500 })
  }

  // Return updated presences with display names
  const [presencesRes, membersRes] = await Promise.all([
    db.from('accountability_vigil_presences')
      .select('user_id, note, created_at')
      .eq('group_id', group_id)
      .eq('presence_date', today)
      .order('created_at'),
    db.from('accountability_group_members')
      .select('user_id, display_name')
      .eq('group_id', group_id),
  ])

  const nameMap: Record<string, string> = {}
  for (const m of (membersRes.data ?? [])) nameMap[m.user_id] = m.display_name

  const today_presences = (presencesRes.data ?? []).map(p => ({
    user_id:      p.user_id,
    display_name: nameMap[p.user_id] ?? '同行者',
    note:         p.note,
    created_at:   p.created_at,
  }))

  return NextResponse.json({ ok: true, today_presences })
}
