import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db = createServiceClient()
    const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
    if (!caller || !['church_admin', 'super_admin'].includes(caller.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { fellowship_id, name, leader_id, meeting_address, leader_contact } = body

    if (!fellowship_id) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

    const { data: existing } = await db
      .from('fellowships')
      .select('id, name, leader_id, status')
      .eq('id', fellowship_id)
      .single()

    if (!existing || existing.status === 'archived') {
      return NextResponse.json({ error: 'fellowship not found or archived' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (name !== undefined) patch.name = name
    if (leader_id !== undefined) patch.leader_id = leader_id
    // meeting_address and leader_contact accept explicit null to clear values
    if (meeting_address !== undefined) patch.meeting_address = meeting_address
    if (leader_contact !== undefined) patch.leader_contact = leader_contact

    if (Object.keys(patch).length > 0) {
      await db.from('fellowships').update(patch).eq('id', fellowship_id)
    }

    if (leader_id !== undefined && leader_id !== existing.leader_id) {
      const oldLeaderId = existing.leader_id

      await db.from('users').update({ role: 'member' }).eq('id', oldLeaderId).eq('role', 'leader')

      await db.from('fellowship_members').upsert(
        { fellowship_id, user_id: leader_id, layer2_label: '守望者' },
        { onConflict: 'fellowship_id,user_id' }
      )

      await db.from('users').update({ role: 'leader' }).eq('id', leader_id).eq('role', 'member')
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}
