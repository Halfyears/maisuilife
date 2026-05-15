/**
 * GET  /api/admin/config          — 读取全部 system_configs
 * PATCH /api/admin/config         — 更新单条配置
 *
 * Body (PATCH): { key: string, value: Record<string, unknown> }
 * 仅 super_admin 可操作。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

export interface SystemConfig {
  id:         string
  key:        string
  value:      Record<string, unknown>
  updated_at: string
}

async function getAdminUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const db = createServiceClient()
  const { data: profile } = await db
    .from('users').select('role').eq('id', user.id).single()

  return profile?.role === 'super_admin' ? user : null
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('system_configs')
    .select('id, key, value, updated_at')
    .order('key')

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ configs: data as SystemConfig[] })
}

const PatchSchema = z.object({
  key:   z.string().min(1),
  value: z.record(z.unknown()),
})

export async function PATCH(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const { key, value } = parsed.data
  const db = createServiceClient()

  const { error } = await db
    .from('system_configs')
    .update({ value, updated_by: user.id })
    .eq('key', key)

  if (error) {
    console.error('[admin/config] update error:', error.code)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
