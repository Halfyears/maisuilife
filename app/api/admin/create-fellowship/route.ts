/**
 * POST /api/admin/create-fellowship
 *
 * Body: { name: string, leader_id?: string }
 *   - leader_id: optional UUID of a user with group_leader role.
 *                If omitted, fellowship is created without a leader
 *                (pastor/admin acts temporarily).
 *
 * Only callable by church_admin or super_admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  name:      z.string().min(1).max(100),
  leader_id: z.string().uuid().optional(),
})

async function getAdminUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const db = createServiceClient()
  const { data: profile } = await db
    .from('users').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  return ['church_admin', 'super_admin'].includes(role) ? user : null
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const { name, leader_id } = parsed.data
  const db = createServiceClient()

  let leaderName: string | null = null

  if (leader_id) {
    const { data: leaderProfile } = await db
      .from('users').select('display_name').eq('id', leader_id).single()

    if (!leaderProfile) {
      return NextResponse.json({ error: 'leader_not_found' }, { status: 404 })
    }
    leaderName = leaderProfile.display_name
  }

  const appointmentToken = leader_id ? randomBytes(32).toString('hex') : null

  const { data: fellowship, error: insertErr } = await db
    .from('fellowships')
    .insert(
      leader_id && appointmentToken
        ? { name, status: 'approved', leader_pending_id: leader_id, leader_appointment_token: appointmentToken }
        : { name, status: 'approved' }
    )
    .select('id, invite_code, name')
    .single()

  if (insertErr || !fellowship) {
    console.error('[create-fellowship] insert error:', insertErr?.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    fellowship_id:     fellowship.id,
    name:              fellowship.name,
    invite_code:       fellowship.invite_code,
    leader_name:       leaderName,
    appointment_token: appointmentToken,
  })
}
