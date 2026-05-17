import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/accountability/group?id=<uuid>
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('id')
  if (!groupId) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const db = createServiceClient()

  // Verify organizer
  const { data: group } = await db
    .from('accountability_groups')
    .select('*')
    .eq('id', groupId)
    .eq('organizer_id', user.id)
    .single()

  if (!group) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json({ group })
}
