import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface FellowshipRow {
  id: string
  name: string
  leader_id: string | null
  leader_pending_id: string | null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { token } = body
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token_required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: raw } = await db
    .from('fellowships')
    .select('id, name, leader_id, leader_pending_id')
    .eq('leader_appointment_token', token)
    .maybeSingle()

  if (!raw) return NextResponse.json({ error: 'invalid_token' }, { status: 404 })

  const fellowship = raw as unknown as FellowshipRow

  if (fellowship.leader_pending_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error: updateErr } = await db
    .from('fellowships')
    .update({
      leader_id:                fellowship.leader_pending_id,
      leader_pending_id:        null,
      leader_appointment_token: null,
    } as never)
    .eq('id', fellowship.id)

  if (updateErr) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // Downgrade the outgoing leader (only plain group_leader, never admin/pastor)
  if (fellowship.leader_id && fellowship.leader_id !== fellowship.leader_pending_id) {
    await db.from('users')
      .update({ role: 'member' } as never)
      .eq('id', fellowship.leader_id)
      .eq('role', 'group_leader')
  }

  // Promote incoming leader from member → group_leader
  await db.from('users')
    .update({ role: 'group_leader' } as never)
    .eq('id', user.id)
    .eq('role', 'member')

  // Fetch display name for fellowship member label
  const { data: profile } = await db
    .from('users').select('display_name').eq('id', user.id).maybeSingle()
  const displayName = (profile as { display_name: string } | null)?.display_name ?? '组长'

  // Ensure they are a fellowship member
  await db.from('fellowship_members').upsert(
    { fellowship_id: fellowship.id, user_id: user.id, layer2_label: displayName },
    { onConflict: 'fellowship_id,user_id' }
  )

  return NextResponse.json({ ok: true, fellowship_id: fellowship.id })
}
