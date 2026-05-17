/**
 * PATCH /api/prayer/resolve  — 发布者标记"已蒙恩"
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { request_id } = await req.json()
  if (!request_id) return NextResponse.json({ error: 'missing_request_id' }, { status: 400 })

  const db = createServiceClient()

  const { data: request } = await db
    .from('prayer_requests')
    .select('user_id')
    .eq('id', request_id)
    .maybeSingle()

  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (request.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await db
    .from('prayer_requests')
    .update({ is_resolved: true })
    .eq('id', request_id)

  return NextResponse.json({ ok: true })
}
