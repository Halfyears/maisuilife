import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ProjectorSlides } from './projector-slides'

export const metadata  = { title: '投屏 — 麦穗喜乐' }
export const revalidate = 30

export default async function ProjectorPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: fellowship } = await db
    .from('fellowships')
    .select('id, name')
    .eq('leader_id', user.id)
    .single()

  if (!fellowship) redirect('/fellowship/console')

  const { data: members } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowship.id)

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
  const today = new Date().toISOString().slice(0, 10)

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
