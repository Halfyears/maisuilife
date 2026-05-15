/**
 * POST /api/admin/circuit-breaker
 *
 * 全局 AI 熔断开关。
 * Body: { active: boolean, reason?: string }
 *
 * active=false → 所有 /api/stt 请求立即返回 503
 * active=true  → 恢复正常
 *
 * 仅 super_admin 可操作。操作记录在配置值内。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: profile } = await db
    .from('users').select('role').eq('id', user.id).single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body: { active?: boolean; reason?: string } = await req.json().catch(() => ({}))
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const newValue = {
    active:          body.active,
    disabled_at:     body.active ? null : new Date().toISOString(),
    disabled_reason: body.active ? '' : (body.reason ?? '管理员手动关闭'),
    toggled_by:      user.id,   // auditing — ok to store admin's own id here
  }

  const { error } = await db
    .from('system_configs')
    .update({ value: newValue, updated_by: user.id })
    .eq('key', 'ai_circuit_breaker')

  if (error) {
    console.error('[circuit-breaker] update error:', error.code)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  console.log(`[circuit-breaker] AI ${body.active ? 'ENABLED' : 'DISABLED'} by admin ${user.id}`)
  return NextResponse.json({ success: true, ai_active: body.active })
}
