import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ProjectorSlides } from './projector-slides'
import { todayLocal } from '@/lib/date'

export const metadata  = { title: '投屏 — 麦穗喜乐' }
export const revalidate = 0

export default async function ProjectorPage({
  searchParams,
}: {
  searchParams: { fellowship_id?: string }
}) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createAdminClient()

  // Resolve user role
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isPrivileged = ['church_admin', 'super_admin'].includes(role)

  // Fellowship resolution:
  // - group_leader → their fellowship by leader_id
  // - privileged   → ?fellowship_id=xxx param (passed from console page link)
  let fellowship: { id: string; name: string } | null = null

  if (isPrivileged && searchParams.fellowship_id) {
    const { data } = await db
      .from('fellowships')
      .select('id, name')
      .eq('id', searchParams.fellowship_id)
      .single()
    fellowship = data
  } else {
    const { data } = await db
      .from('fellowships')
      .select('id, name')
      .eq('leader_id', user.id)
      .maybeSingle()
    fellowship = data
  }

  if (!fellowship) redirect('/fellowship/console')

  const { data: members } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowship.id)

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
  const today = todayLocal()

  const [alignmentsRes, sessionPlanRes] = await Promise.all([
    memberIds.length > 0
      ? db.from('daily_alignments').select('status_tag').in('user_id', memberIds).eq('date', today).eq('is_visible', true)
      : Promise.resolve({ data: [] }),
    db.from('fellowship_session_plans')
      .select('theme, scripture_ref, scripture_text')
      .eq('fellowship_id', fellowship.id)
      .maybeSingle(),
  ])

  const counts: Record<string, number> = {}
  ;((alignmentsRes as { data: { status_tag: string }[] | null }).data ?? [])
    .forEach((a: { status_tag: string }) => {
      counts[a.status_tag] = (counts[a.status_tag] ?? 0) + 1
    })

  const total   = Object.values(counts).reduce((s, n) => s + n, 0)
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a)

  const sessionPlan = sessionPlanRes.data as {
    theme: string | null
    scripture_ref: string | null
    scripture_text: string | null
  } | null

  const today_zh = new Date().toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <ProjectorSlides
      fellowshipId={fellowship.id}
      fellowshipName={fellowship.name}
      todayZh={today_zh}
      theme={sessionPlan?.theme ?? null}
      scriptureRef={sessionPlan?.scripture_ref ?? null}
      scriptureText={sessionPlan?.scripture_text ?? null}
      moodEntries={entries}
      total={total}
    />
  )
}
