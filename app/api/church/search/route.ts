import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/church/search?q=name
// Public search — returns matching churches (no auth required for browsing).
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()

  const db = createAdminClient()

  let query = db
    .from('churches')
    .select('id, name, city, address')
    .order('name')
    .limit(20)

  if (q) {
    query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  return NextResponse.json({ churches: data ?? [] })
}
