import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const session_id = typeof body.session_id === 'string' ? body.session_id : ''
  if (!session_id) return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })

  const db = createAdminClient()

  // Verify session is in harvest state and user is a member of that fellowship
  const { data: session } = await db
    .from('fellowship_sessions')
    .select('id, fellowship_id, state, amen_count')
    .eq('id', session_id)
    .single()
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (session.state !== 'harvest') return NextResponse.json({ error: 'wrong_state' }, { status: 400 })

  // Privileged roles bypass membership check
  const { data: prof } = await db.from('users').select('role').eq('id', user.id).single()
  const isPrivileged = ['church_admin', 'super_admin'].includes(prof?.role ?? '')

  if (!isPrivileged) {
    const { data: member } = await db
      .from('fellowship_members')
      .select('user_id')
      .eq('fellowship_id', session.fellowship_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })
  }

  const { data: updated, error } = await db
    .from('fellowship_sessions')
    .update({ amen_count: (session.amen_count ?? 0) + 1 })
    .eq('id', session_id)
    .select('amen_count')
    .single()

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ amen_count: updated.amen_count })
}
