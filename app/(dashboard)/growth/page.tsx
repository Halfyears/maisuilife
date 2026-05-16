import { redirect } from 'next/navigation'
import { BarChart2, Sprout, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'

export const metadata = { title: '灵命成长 — 麦穗喜乐' }
export const revalidate = 60

export default async function GrowthPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch last 30 days of alignment counts by status_tag
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: alignments } = await supabase
    .from('daily_alignments')
    .select('status_tag, date')
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgo.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  const total   = alignments?.length ?? 0
  const streaks = computeStreak(alignments?.map(a => a.date) ?? [])

  // Count by tag
  const tagCounts: Record<string, number> = {}
  for (const a of alignments ?? []) {
    tagCounts[a.status_tag] = (tagCounts[a.status_tag] ?? 0) + 1
  }
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <BarChart2 className="h-4.5 w-4.5 text-amber-500" />
          <h1 className="text-sm font-bold text-stone-900">灵命成长</h1>
          <span className="ml-auto text-[11px] text-stone-400">近 30 天</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32">

        {/* Stats row */}
        {total > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              { label: '内室记录', value: `${total} 天`, emoji: '📖' },
              { label: '连续同行', value: `${streaks} 天`, emoji: '🔥' },
              { label: '常见心境', value: topTag ?? '—', emoji: '🌿' },
            ].map(({ label, value, emoji }) => (
              <div key={label}
                className="flex flex-col items-center gap-1 rounded-2xl border border-stone-100
                           bg-white/90 py-4 shadow-md shadow-amber-900/5 backdrop-blur-md">
                <span className="text-xl">{emoji}</span>
                <span className="text-base font-bold text-stone-900">{value}</span>
                <span className="text-[10px] font-medium text-stone-400">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main placeholder card */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 p-6 shadow-md shadow-amber-900/5 backdrop-blur-md">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
              <Sprout className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <h2 className="text-base font-bold text-stone-900 tracking-wide">📊 灵命成长轨迹</h2>
          </div>

          <p className="text-sm font-medium text-stone-500 leading-relaxed">
            您的每日内室记录与属灵成长轨迹正在这里悄悄扎根，
            生命的话语正源源不断滋养这里…
          </p>

          {total === 0 ? (
            <div className="mt-5 rounded-xl bg-amber-50/70 border border-amber-100 px-4 py-4 text-center">
              <p className="text-sm font-medium text-amber-700">
                开始你的第一次内室记录，轨迹就从今天开始。
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, count]) => {
                  const pct = Math.round((count / total) * 100)
                  const emoji = TAG_EMOJI[tag] ?? '🌿'
                  return (
                    <div key={tag}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-600">
                          {emoji} {tag}
                        </span>
                        <span className="text-xs text-stone-400 tabular-nums">
                          {count} 次 · {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Scripture card */}
        <div className="mt-4 rounded-2xl border border-amber-100/60 bg-gradient-to-br
                        from-amber-50/60 to-orange-50/40 p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1.5">属灵鼓励</p>
              <p className="text-sm text-stone-700 leading-relaxed italic">
                "那在你们心里动了善工的，必成全这工，直到耶稣基督的日子。"
              </p>
              <p className="mt-2 text-xs text-stone-400">— 腓立比书 1:6</p>
            </div>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}

const TAG_EMOJI: Record<string, string> = {
  '感恩': '🙏', '平安': '🕊️', '疲惫': '🌙', '干渴': '🌿', '混乱': '🌊',
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  let streak = 1
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i + 1]).getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }
  return streak
}
