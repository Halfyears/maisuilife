import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { ChurchHubClient } from './_components/church-hub-client'
import type { PendingFellowship, ActiveFellowship, SelectableMember } from './_types'

export const dynamic = 'force-dynamic'
export const metadata = { title: '教会管理中枢 — 麦穗喜乐' }

export default async function ChurchHubPage() {
  // ── Auth + role check ─────────────────────────────────────────
  let db: ReturnType<typeof createServiceClient>
  try {
    db = createServiceClient()
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set in this environment
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center max-w-sm">
          <p className="text-sm font-bold text-red-700 mb-2">服务配置缺失</p>
          <p className="text-xs text-red-500">请在 Vercel 环境变量中设置 SUPABASE_SERVICE_ROLE_KEY</p>
        </div>
      </div>
    )
  }

  // Get current user
  const { data: { user }, error: authErr } = await db.auth.getUser()
  if (authErr || !user) redirect('/login')

  // Check church_admin role
  const { data: profile } = await db
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'church_admin') {
    redirect('/daily')
  }

  const adminName = profile?.display_name ?? '管理员'

  // ── Fetch pending fellowships ─────────────────────────────────
  let pending: PendingFellowship[] = []
  try {
    const { data } = await db
      .from('fellowships')
      .select('id, name, meeting_address, leader_contact, created_at, users!fellowships_leader_id_fkey(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    pending = (data ?? []) as unknown as PendingFellowship[]
  } catch { /* ignore — show empty */ }

  // ── Fetch active fellowships with members ─────────────────────
  let active: ActiveFellowship[] = []
  try {
    const { data } = await db
      .from('fellowships')
      .select('id, name, invite_code, meeting_address, leader_contact, users!fellowships_leader_id_fkey(id, display_name), fellowship_members(user_id)')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
    active = (data ?? []) as unknown as ActiveFellowship[]
  } catch { /* ignore — show empty */ }

  // ── Fetch all members (for leader picker + name resolution) ───
  let members: SelectableMember[] = []
  try {
    const { data } = await db
      .from('users')
      .select('id, display_name, role')
      .order('display_name', { ascending: true })
    members = (data ?? []) as SelectableMember[]
  } catch { /* ignore */ }

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Building2 className="h-4 w-4 text-violet-500" />
          <h1 className="text-sm font-bold text-stone-900">教会管理中枢</h1>
          <span className="ml-auto text-[11px] text-stone-400">{adminName}</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32">
        <ChurchHubClient
          pending={pending}
          active={active}
          members={members}
          adminName={adminName}
        />
      </main>

      <BottomNav />
    </div>
  )
}
