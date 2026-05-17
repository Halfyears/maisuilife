import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { AdminTopNav } from '@/components/shared/admin-top-nav'
import { ChurchHubClient } from './_components/church-hub-client'
import { Church, AlertTriangle } from 'lucide-react'

export const metadata = { title: '教会管理中枢 — 麦穗喜乐' }
export const revalidate = 0

export type PendingFellowship = {
  id: string
  name: string
  meeting_address: string | null
  leader_contact: string | null
  created_at: string
  users: { id: string; display_name: string } | null
}

export type FellowshipMember = {
  user_id: string
}

export type ActiveFellowship = {
  id: string
  name: string
  invite_code: string
  status: string
  meeting_address: string | null
  leader_contact: string | null
  church_id: string | null
  approved_at: string | null
  created_at: string
  users: { id: string; display_name: string } | null
  fellowship_members: FellowshipMember[]
}

export type SelectableMember = {
  id: string
  display_name: string
  role: string
}

function ConfigError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center gap-4">
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <p className="text-sm font-bold text-stone-900">配置错误</p>
      <p className="text-xs text-stone-500 max-w-xs leading-relaxed">{message}</p>
    </div>
  )
}

export default async function ChurchHubPage() {
  // ── 1. Auth via anon client ───────────────────────────────────
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 2. Guard: service key required ───────────────────────────
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <ConfigError message="SUPABASE_SERVICE_ROLE_KEY 未在 Vercel 环境变量中设置。请添加后重新部署。" />
  }

  // ── 3. All DB queries via service client (bypasses RLS entirely) ──
  // This eliminates every possible RLS join failure on the users / fellowships tables.
  let pending: PendingFellowship[] = []
  let active:  ActiveFellowship[]  = []
  let members: SelectableMember[]  = []
  let adminName = '教会管理员'

  try {
    const db = createServiceClient()

    const [profileRes, pendingRes, activeRes, membersRes] = await Promise.all([
      db
        .from('users')
        .select('display_name, role')
        .eq('id', user.id)
        .single(),



      // Pending fellowships — leader name fetched via separate users lookup below
      db
        .from('fellowships')
        .select('id, name, meeting_address, leader_contact, created_at, leader_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),

      db
        .from('fellowships')
        .select(`
          id, name, invite_code, status, meeting_address, leader_contact,
          church_id, approved_at, created_at, leader_id,
          fellowship_members(user_id)
        `)
        .in('status', ['approved'])
        .order('created_at', { ascending: false }),

      db
        .from('users')
        .select('id, display_name, role')
        .not('role', 'eq', 'super_admin')
        .order('display_name'),
    ])

    const profile = profileRes.data
    if (!profile || !['church_admin', 'super_admin'].includes(profile.role)) {
      redirect('/')
    }

    adminName = profile.display_name ?? '教会管理员'

    // Build members lookup for leader name resolution
    const allUsers: SelectableMember[] = (membersRes.data ?? []) as SelectableMember[]

    // Attach leader display_name to pending fellowships (no FK join needed)
    const rawPending = (pendingRes.data ?? []) as Array<{
      id: string; name: string; meeting_address: string | null
      leader_contact: string | null; created_at: string; leader_id: string
    }>
    pending = rawPending.map(f => ({
      id:              f.id,
      name:            f.name,
      meeting_address: f.meeting_address,
      leader_contact:  f.leader_contact,
      created_at:      f.created_at,
      users: (() => {
        const u = allUsers.find(m => m.id === f.leader_id)
        return u ? { id: u.id, display_name: u.display_name } : null
      })(),
    }))

    // Attach leader display_name to active fellowships (no FK join needed)
    const rawActive = (activeRes.data ?? []) as Array<{
      id: string; name: string; invite_code: string; status: string
      meeting_address: string | null; leader_contact: string | null
      church_id: string | null; approved_at: string | null
      created_at: string; leader_id: string
      fellowship_members: { user_id: string }[]
    }>
    active = rawActive.map(f => ({
      id:              f.id,
      name:            f.name,
      invite_code:     f.invite_code,
      status:          f.status,
      meeting_address: f.meeting_address,
      leader_contact:  f.leader_contact,
      church_id:       f.church_id,
      approved_at:     f.approved_at,
      created_at:      f.created_at,
      users: (() => {
        const u = allUsers.find(m => m.id === f.leader_id)
        return u ? { id: u.id, display_name: u.display_name } : null
      })(),
      fellowship_members: Array.isArray(f.fellowship_members) ? f.fellowship_members : [],
    }))

    members = allUsers

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[church/hub] data fetch error:', msg)
    return <ConfigError message={`数据加载失败：${msg}`} />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-5 py-3.5">
          <Church className="h-4 w-4 text-violet-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900">教会管理中枢</h1>
          <span className="text-xs text-stone-400 hidden sm:block">· {adminName}</span>
          <div className="ml-auto">
            <AdminTopNav backLabel="返回主大盘" backHref="/" />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-32">
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
