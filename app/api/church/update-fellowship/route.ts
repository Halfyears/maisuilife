/**
 * PATCH /api/church/update-fellowship
 * Body: { id: string, name?: string, leader_id?: string, leader_pending_id?: string, status?: string }
 *   leader_id:         direct assignment (no confirmation required)
 *   leader_pending_id: appointment-flow — generates a token the candidate must confirm
 * Auth: church_admin or super_admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const ALLOWED_ROLES = ['super_admin', 'church_admin']
const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'ended'] as const

const Schema = z.object({
  id:                z.string().uuid(),
  name:              z.string().min(1).max(100).optional(),
  leader_id:         z.string().uuid().optional(),
  leader_pending_id: z.string().uuid().optional(),
  status:            z.enum(ALLOWED_STATUSES).optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (!ALLOWED_ROLES.includes((profile as { role: string } | null)?.role ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

  const { id, name, leader_id, leader_pending_id, status } = parsed.data
  const updates: Record<string, unknown> = {}
  if (name      !== undefined) updates.name      = name
  if (leader_id !== undefined) updates.leader_id = leader_id
  if (status    !== undefined) updates.status    = status

  let appointmentToken: string | null = null
  if (leader_pending_id !== undefined) {
    appointmentToken = randomBytes(32).toString('hex')
    updates.leader_pending_id        = leader_pending_id
    updates.leader_appointment_token = appointmentToken
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const { error } = await db.from('fellowships').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true, appointment_token: appointmentToken })
}
