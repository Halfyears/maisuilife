/**
 * PATCH /api/user/profile — 更新当前用户的显示名
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { display_name } = await req.json()
  const name = (display_name ?? '').trim().slice(0, 30)
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from('users')
    .update({ display_name: name })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, display_name: name })
}
