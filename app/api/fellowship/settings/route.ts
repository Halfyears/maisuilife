/**
 * PATCH /api/fellowship/settings
 * 更新团契设置：meeting_mode 和/或 yt_link。
 * 仅组长可操作。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const SettingsSchema = z.object({
  fellowship_id: z.string().uuid(),
  meeting_mode:  z.enum(['in-person', 'online']).optional(),
  yt_link:       z.string()
                   .url()
                   .regex(/^https:\/\/(www\.)?youtube\.com\/|^https:\/\/youtu\.be\//)
                   .nullable()
                   .optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_params', detail: parsed.error.flatten() }, { status: 400 })
  }

  const { fellowship_id, meeting_mode, yt_link } = parsed.data
  const db = createServiceClient()

  // Verify caller is the leader
  const { data: fellowship } = await db
    .from('fellowships')
    .select('leader_id')
    .eq('id', fellowship_id)
    .single()

  if (!fellowship || fellowship.leader_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (meeting_mode !== undefined) updates.meeting_mode = meeting_mode
  if (yt_link      !== undefined) updates.yt_link      = yt_link

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 })
  }

  const { error: updateErr } = await db
    .from('fellowships')
    .update(updates)
    .eq('id', fellowship_id)

  if (updateErr) {
    console.error('[fellowship/settings] update error:', updateErr.code)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
