import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DailyForm } from '@/components/daily/daily-form'
import { PastoralNotification } from '@/components/shared/pastoral-notification'

export const metadata = { title: '今日内室 — 麦穗喜乐' }
export const revalidate = 0

export default async function DailyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const db    = createServiceClient()

  // Parallel fetch: today's alignment + membership + pending pastoral request
  const [alignmentRes, membershipRes, pastoralRes] = await Promise.all([
    supabase
      .from('daily_alignments')
      .select('id, status_tag')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),

    db
      .from('fellowship_members')
      .select('fellowship_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),

    // Level 3: check if a leader has sent a care request to this member
    db
      .from('pastoral_requests')
      .select('id, leader_id')
      .eq('member_id', user.id)
      .eq('status', 'PENDING')
      .limit(1)
      .maybeSingle(),
  ])

  const existing     = alignmentRes.data
  const fellowshipId = membershipRes.data?.fellowship_id ?? undefined

  // Fetch leader display_name for the notification (if any)
  const pendingRequest = pastoralRes.data
  let leaderName: string | undefined
  if (pendingRequest) {
    const { data: leader } = await db
      .from('users')
      .select('display_name')
      .eq('id', pendingRequest.leader_id)
      .single()
    leaderName = leader?.display_name
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-8">
      {/* ── Header ─────────────────────────────── */}
      <header className="mb-8 text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {formatChineseDate(new Date())}
        </p>
        <h1 className="font-serif text-2xl font-bold text-foreground">今日内室</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          将今日的心放在祂面前
        </p>
      </header>

      {/* ── Level 3: pastoral notification (shown above form) ─ */}
      {pendingRequest && (
        <div className="mb-6">
          <PastoralNotification
            requestId={pendingRequest.id}
            leaderName={leaderName}
          />
        </div>
      )}

      {/* ── Main content ─────────────────────────── */}
      {existing ? (
        <AlreadySubmitted statusTag={existing.status_tag} />
      ) : (
        <DailyForm fellowshipId={fellowshipId} />
      )}
    </main>
  )
}

function AlreadySubmitted({ statusTag }: { statusTag: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/15 text-2xl">
        ✓
      </div>
      <p className="font-medium text-foreground">今日已对齐</p>
      <p className="text-sm text-muted-foreground">心境：{statusTag}</p>
      <p className="text-xs text-muted-foreground">
        明日内室将在 00:00 开放，今日记录已安全交托。
      </p>
    </div>
  )
}

function formatChineseDate(d: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日  星期${days[d.getDay()]}`
}
