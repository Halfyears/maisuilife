import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { ChurchHubClient } from './_components/church-hub-client'
import { Church } from 'lucide-react'

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
  fellowship_members: { user_id: string }[]
}

export type SelectableMember = {
  id: string
  display_name: string
  role: string
}

export default async function ChurchHubPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  const [pendingRes, activeRes, membersRes] = await Promise.all([
    supabase
      .from('fellowships')
      .select('id, name, meeting_address, leader_contact, created_at, users!leader_id(id, display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),

    supabase
      .from('fellowships')
      .select('id, name, invite_code, status, meeting_address, leader_contact, church_id, approved_at, created_at, users!leader_id(id, display_name), fellowship_members(user_id)')
      .in('status', ['approved'])
      .order('created_at', { ascending: false }),

    supabase
      .from('users')
      .select('id, display_name, role')
      .not('role', 'eq', 'super_admin')
      .order('display_name'),
  ])

  const pending = (pendingRes.data ?? []) as unknown as PendingFellowship[]
  const active  = (activeRes.data  ?? []) as unknown as ActiveFellowship[]
  const members = (membersRes.data ?? []) as SelectableMember[]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-5 py-3.5">
          <Church className="h-4 w-4 text-amber-500" />
          <h1 className="text-sm font-bold text-stone-900">教会管理中枢</h1>
          <span className="ml-auto text-xs text-stone-400">{profile?.display_name}</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-32">
        <ChurchHubClient
          pending={pending}
          active={active}
          members={members}
        />
      </main>

      <BottomNav />
    </div>
  )
}
