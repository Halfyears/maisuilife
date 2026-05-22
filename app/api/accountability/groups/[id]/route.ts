import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function resolveActor(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, db: null, caller: null }
  const db = createAdminClient()
  const { data: caller } = await db.from('users').select('role').eq('id', user.id).single()
  return { user, db, caller }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, db, caller } = await resolveActor(req)
  if (!user || !db) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: group } = await db
    .from('accountability_groups')
    .select('organizer_id')
    .eq('id', params.id)
    .single()

  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isAdmin = ['church_admin', 'super_admin'].includes(caller?.role ?? '')
  if (group.organizer_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  if (!['active', 'ended'].includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  await db.from('accountability_groups').update({ status: body.status }).eq('id', params.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, db, caller } = await resolveActor(req)
  if (!user || !db) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: group } = await db
    .from('accountability_groups')
    .select('organizer_id')
    .eq('id', params.id)
    .single()

  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isAdmin = ['church_admin', 'super_admin'].includes(caller?.role ?? '')
  if (group.organizer_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db.from('accountability_groups').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
