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
    const { fellowship_id, meeting_address, leader_contact } = body

    if (!fellowship_id) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

    const { data: fellowship } = await db
      .from('fellowships')
      .select('id, name, leader_id, status')
      .eq('id', fellowship_id)
      .single()

    if (!fellowship || fellowship.status !== 'pending') {
      return NextResponse.json({ error: 'not_pending' }, { status: 400 })
    }

    await db.from('fellowships').update({
      status: 'approved',
      church_id: user.id,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      meeting_address: meeting_address ?? null,
      leader_contact: leader_contact ?? null,
    }).eq('id', fellowship_id)

    await db.from('users').update({ role: 'group_leader' })
      .eq('id', fellowship.leader_id)
      .eq('role', 'member')
      .neq('role', 'super_admin')
      .neq('role', 'church_admin')

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}
