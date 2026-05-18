/**
 * GET  /api/prayer?fellowship_id=<uuid>  — 列出代祷需求
 * POST /api/prayer                        — 发布新代祷需求
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export interface PrayerRequestItem {
  id:           string
  is_self:      boolean
  requester:    string | null   // null = 匿名
  is_anonymous: boolean
  title:        string
  content:      string | null
  is_resolved:  boolean
  created_at:   string
  pray_count:   number          // 承诺代祷的人数
  total_prayers:number          // 累计代祷次数
  i_committed:  boolean         // 自己是否已承诺
  i_prayed_today: boolean       // 今日是否已点"今日已代祷"
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fellowshipId = req.nextUrl.searchParams.get('fellowship_id')
  if (!fellowshipId) return NextResponse.json({ error: 'missing_fellowship_id' }, { status: 400 })

  const db = createServiceClient()

  const { data: membership } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowshipId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: rows } = await db
    .from('prayer_requests')
    .select('id, user_id, display_name, is_anonymous, title, content, is_resolved, created_at, prayer_commitments(user_id, total_count, last_prayed)')
    .eq('fellowship_id', fellowshipId)
    .order('is_resolved', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(30)

  const today = new Date().toISOString().slice(0, 10)

  const items: PrayerRequestItem[] = (rows ?? []).map(r => {
    const commitments = (r.prayer_commitments as { user_id: string; total_count: number; last_prayed: string }[]) ?? []
    const mine = commitments.find(c => c.user_id === user.id)
    return {
      id:            r.id,
      is_self:       r.user_id === user.id,
      requester:     r.is_anonymous ? null : r.display_name,
      is_anonymous:  r.is_anonymous,
      title:         r.title,
      content:       r.content ?? null,
      is_resolved:   r.is_resolved,
      created_at:    r.created_at,
      pray_count:    commitments.length,
      total_prayers: commitments.reduce((s, c) => s + c.total_count, 0),
      i_committed:   !!mine,
      i_prayed_today: mine ? mine.last_prayed.slice(0, 10) === today : false,
    }
  })

  return NextResponse.json({ requests: items })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fellowship_id, title, content, is_anonymous } = body

  if (!fellowship_id || !title?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: membership } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowship_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: profile } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: created, error } = await db
    .from('prayer_requests')
    .insert({
      fellowship_id,
      user_id:      user.id,
      display_name: profile?.display_name ?? '',
      is_anonymous: !!is_anonymous,
      title:        title.trim().slice(0, 100),
      content:      content?.trim().slice(0, 500) || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({
    id:           (created as { id: string }).id,
    display_name: is_anonymous ? null : (profile?.display_name ?? ''),
  })
}
