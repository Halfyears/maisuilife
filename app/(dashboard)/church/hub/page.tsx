import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Home } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { ChurchHubClient } from './_components/church-hub-client'
import type { PendingFellowship, ActiveFellowship, SelectableMember } from './_types'

export const dynamic = 'force-dynamic'
export const metadata = { title: '教会管理中枢 — 麦穗喜乐' }

export default async function ChurchHubPage() {
  // ── Auth (anon client, same pattern as admin layouts) ─────────
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  // ── Role check (service client, same pattern as admin layouts) ─
  const db = createServiceClient()
  const { data: profile } = await db
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  const adminRoles = ['church_admin', 'super_admin']
  if (!profile || !adminRoles.includes(profile.role)) {
    redirect('/daily')
  }

  const adminName = profile.display_name ?? '管理员'

  // ── Pending fellowships ───────────────────────────────────────
  const { data: pendingRaw } = await db
    .from('fellowships')
    .select('id, name, meeting_address, leader_contact, created_at, users!fellowships_leader_id_fkey(display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const pending = (pendingRaw ?? []) as unknown as PendingFellowship[]

  // ── Active fellowships with members ──────────────────────────
  const { data: activeRaw } = await db
    .from('fellowships')
    .select('id, name, invite_code, meeting_address, leader_contact, users!fellowships_leader_id_fkey(id, display_name), fellowship_members(user_id)')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  const active = (activeRaw ?? []) as unknown as ActiveFellowship[]

  // ── All members (for leader picker) ──────────────────────────
  const { data: membersRaw } = await db
    .from('users')
    .select('id, display_name, role')
    .order('display_name', { ascending: true })

  const members = (membersRaw ?? []) as SelectableMember[]

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Building2 className="h-4 w-4 text-violet-500" />
          <h1 className="text-sm font-bold text-stone-900">教会管理中枢</h1>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            返回主大盘
          </Link>
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
