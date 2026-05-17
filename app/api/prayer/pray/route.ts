/**
 * POST /api/prayer/pray  — 记录一次代祷（今日已代祷）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { request_id } = await req.json()
  if (!request_id) return NextResponse.json({ error: 'missing_request_id' }, { status: 400 })

  const db = createServiceClient()

  // 验证请求存在且用户是该团契成员
  const { data: request } = await db
    .from('prayer_requests')
    .select('fellowship_id')
    .eq('id', request_id)
    .maybeSingle()

  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: membership } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', request.fellowship_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 查询是否已有承诺记录
  const { data: existing } = await db
    .from('prayer_commitments')
    .select('id, total_count')
    .eq('request_id', request_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await db
      .from('prayer_commitments')
      .update({
        last_prayed: new Date().toISOString(),
        total_count: existing.total_count + 1,
      })
      .eq('id', existing.id)
  } else {
    await db
      .from('prayer_commitments')
      .insert({
        request_id,
        user_id:     user.id,
        total_count: 1,
        last_prayed: new Date().toISOString(),
      })
  }

  return NextResponse.json({ ok: true })
}
