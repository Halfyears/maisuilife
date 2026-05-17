import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const out: Record<string, unknown> = {}
  try {
    const supabase = createClient()
    out.client_ok = true

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    out.auth_error = authErr?.message ?? null
    out.user_id    = user?.id ?? null
    out.user_email = user?.email ?? null

    if (user) {
      const { data, error: dbErr } = await supabase
        .from('users')
        .select('role, display_name, settings')
        .eq('id', user.id)
        .single()
      out.db_error   = dbErr?.message ?? null
      out.db_code    = dbErr?.code ?? null
      out.user_role  = data?.role ?? null
      out.user_name  = data?.display_name ?? null
    }
  } catch (err) {
    out.caught = String(err)
  }
  return NextResponse.json(out)
}
