/**
 * PATCH /api/church/update-user-role
 * Body: { user_id: string, role: string }
 * Auth:
 *   church_admin  → can set: user, group_leader, pastor
 *   super_admin   → can set: any role including church_admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const ALL_ROLES    = ['user', 'group_leader', 'pastor', 'church_admin', 'super_admin'] as const
const CHURCH_ROLES = ['user', 'group_leader', 'pastor'] as const

const Schema = z.object({
  user_id: z.string().uuid(),
  role:    z.enum(ALL_ROLES),
})

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const actorUser = authData?.user ?? null
  if (!actorUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: actor } = await db.from('users').select('role').eq('id', actorUser.id).single()
  const actorRole = (actor as { role: string } | null)?.role ?? ''

  if (!['super_admin', 'church_admin'].includes(actorRole)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const { user_id, role } = parsed.data

  // church_admin cannot assign super_admin or church_admin roles
  if (actorRole === 'church_admin' && !CHURCH_ROLES.includes(role as typeof CHURCH_ROLES[number])) {
    return NextResponse.json({ error: 'permission_denied' }, { status: 403 })
  }

  // Prevent demoting yourself
  if (user_id === actorUser.id) {
    return NextResponse.json({ error: 'cannot_change_own_role' }, { status: 400 })
  }

  const { error } = await db.from('users').update({ role }).eq('id', user_id)
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
