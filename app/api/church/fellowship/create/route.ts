import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const { name, leader_id, meeting_address, leader_contact } = body

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 30) {
      return NextResponse.json({ error: 'name must be 2-30 characters' }, { status: 400 })
    }
    if (!leader_id || !UUID_RE.test(leader_id)) {
      return NextResponse.json({ error: 'leader_id must be a valid UUID' }, { status: 400 })
    }

    const { data: targetUser } = await db
      .from('users')
      .select('id, role')
      .eq('id', leader_id)
      .single()

    if (!targetUser) return NextResponse.json({ error: 'leader not found' }, { status: 400 })

    const { data: fellowship, error: insertErr } = await db
      .from('fellowships')
      .insert({
        name: name.trim(),
        leader_id,
        status: 'approved',
        church_id: user.id,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        meeting_address: meeting_address ?? null,
        leader_contact: leader_contact ?? null,
      })
      .select('id')
      .single()

    if (insertErr || !fellowship) {
      return NextResponse.json({ error: 'failed to create fellowship' }, { status: 500 })
    }

    await db.from('fellowship_members').insert({
      fellowship_id: fellowship.id,
      user_id: leader_id,
      layer2_label: '守望者',
    })

    await db.from('users').update({ role: 'group_leader' }).eq('id', leader_id).eq('role', 'member')

    return NextResponse.json({ id: fellowship.id })
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}
