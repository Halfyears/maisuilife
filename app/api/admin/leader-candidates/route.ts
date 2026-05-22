import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/admin/leader-candidates
// Returns users with role = 'group_leader' who are NOT yet a leader of any fellowship.
// Only callable by church_admin or super_admin.
export async function GET() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: profile } = await db
    .from('users').select('role').eq('id', user.id).single()

  if (!['church_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // All group_leader users
  const { data: leaders } = await db
    .from('users')
    .select('id, display_name')
    .eq('role', 'group_leader')
    .order('display_name')

  // Fellows that already have a confirmed leader
  const { data: assignedLeaders } = await db
    .from('fellowships')
    .select('leader_id')
    .not('leader_id', 'is', null)

  const assignedIds = new Set(
    ((assignedLeaders ?? []) as { leader_id: string }[]).map(f => f.leader_id)
  )

  const candidates = ((leaders ?? []) as { id: string; display_name: string }[])
    .filter(u => !assignedIds.has(u.id))

  return NextResponse.json({ candidates })
}
