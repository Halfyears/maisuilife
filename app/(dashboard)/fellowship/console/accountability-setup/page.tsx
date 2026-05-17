import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Target } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AccountabilitySetupForm } from '@/components/fellowship/accountability/setup-form'

export const metadata = { title: '同行设置 — 麦穗喜乐' }
export const revalidate = 0

const ROLE_ALLOWED = ['group_leader', 'church_admin', 'super_admin']

export default async function AccountabilitySetupPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: profile } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!ROLE_ALLOWED.includes(profile?.role ?? '')) redirect('/fellowship')

  // Resolve fellowship
  let fellowshipId: string | null = null

  if (['church_admin', 'super_admin'].includes(profile?.role ?? '')) {
    // Admins: use membership fellowship or redirect to console for picker
    const { data: mem } = await db
      .from('fellowship_members')
      .select('fellowship_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    fellowshipId = mem?.fellowship_id ?? null
  } else {
    const { data: f } = await db
      .from('fellowships')
      .select('id')
      .eq('leader_id', user.id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()
    fellowshipId = f?.id ?? null
  }

  if (!fellowshipId) redirect('/fellowship/console')

  const { data: fellowship } = await db
    .from('fellowships')
    .select('id, name, fellowship_type, goal_title, goal_description, goal_category, goal_start_date, goal_end_date, schedule_days_of_week, schedule_time')
    .eq('id', fellowshipId)
    .single()

  if (!fellowship) redirect('/fellowship/console')

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">同行打卡 · 设置</h1>
          <Link
            href="/fellowship/console"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            控制台
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-20">
        <AccountabilitySetupForm fellowship={fellowship as {
          id: string
          name: string
          fellowship_type: 'standard' | 'accountability'
          goal_title: string | null
          goal_description: string | null
          goal_category: 'prayer' | 'bible_reading' | 'custom' | null
          goal_start_date: string | null
          goal_end_date: string | null
          schedule_days_of_week: number[]
          schedule_time: string | null
        }} />
      </main>
    </div>
  )
}
