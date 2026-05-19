/**
 * GET /api/fellowship/outlines?fellowship_id=xxx&limit=10
 * 返回团契最近的备课历史记录（组长 / 管理员专用）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { MeetingOutline } from '@/app/api/fellowship/outline/route'

export const runtime = 'nodejs'

export interface OutlineRecord {
  id:           string
  meeting_type: 'theme' | 'scripture'
  input_query:  string
  tier:         'free' | 'premium'
  outline:      MeetingOutline
  generated_at: string
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fellowshipId = req.nextUrl.searchParams.get('fellowship_id')
  if (!fellowshipId) return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '8'), 20)

  const db = createAdminClient()

  // Auth: leader of this fellowship or privileged admin
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isPrivileged = ['church_admin', 'super_admin'].includes(role)

  if (!isPrivileged) {
    if (role !== 'group_leader') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data: f } = await db
      .from('fellowships').select('id').eq('id', fellowshipId).eq('leader_id', user.id).maybeSingle()
    if (!f) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await db
    .from('fellowship_outlines')
    .select('id, meeting_type, input_query, tier, outline, generated_at')
    .eq('fellowship_id', fellowshipId)
    .order('generated_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []) as OutlineRecord[])
}
