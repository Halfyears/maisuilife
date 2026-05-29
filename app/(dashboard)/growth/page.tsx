import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, Sprout, BookOpen, CalendarDays, Home } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { todayLocal, offsetDate } from '@/lib/date'
import { BottomNav } from '@/components/shared/bottom-nav'
import { GlobalNotice } from '@/components/shared/global-notice'
import { DonationWidget } from '@/components/shared/donation-widget'

export const metadata = { title: '灵命成长 — 麦穗喜乐' }
export const revalidate = 0

const TAG_EMOJI: Record<string, string> = {
  '感恩': '🙏', '平安': '🕊️', '疲惫': '🌙', '干渴': '🌿', '混乱': '🌊',
}

function renderTagEmojis(statusTag: string): string {
  if (!statusTag) return '🌾'
  return statusTag.split(/[、,，]+/)
    .map(t => t.trim())
    .map(t => (TAG_EMOJI[t] ? `${TAG_EMOJI[t]} ${t}` : t))
    .join(' · ')
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.getMonth() + 1
  const day   = d.getDate()
  const days  = ['日', '一', '二', '三', '四', '五', '六']
  return `${month}月${day}日 · 星期${days[d.getDay()]}`
}

function computeStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0
  const sorted    = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const yesterday = offsetDate(today, -1)
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i + 1]).getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }
  return streak
}

export default async function GrowthPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const today    = todayLocal()
  const ninetyAgo = offsetDate(today, -90)
  const thirtyAgo = offsetDate(today, -30)

  // ── Stats: from daily_alignments (full history for streak/total) ───────
  const { data: alignments } = await supabase
    .from('daily_alignments')
    .select('date, status_tag, is_urgent')
    .eq('user_id', user.id)
    .gte('date', ninetyAgo)
    .order('date', { ascending: false })

  // ── Rich data: from spiritual_logs (AI comfort + verse per submission) ──
  // 使用 service client 绕过 RLS，确保能读到用户自己的经文和 AI 回应
  // （spiritual_logs 无 RLS SELECT 策略时，用户客户端会静默返回空）
  const db = createServiceClient()
  const { data: logs } = await db
    .from('spiritual_logs')
    .select('id, mood, ai_comfort, bible_verse, bible_ref, client_date, created_at')
    .eq('user_id', user.id)
    .gte('client_date', ninetyAgo)
    .order('client_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60)

  const records    = alignments ?? []
  const logEntries = logs ?? []

  const total  = records.length
  const streak = computeStreak(records.map(r => r.date), today)

  const recent30 = records.filter(r => r.date >= thirtyAgo)

  // 心境计数（支持多选标签）
  const tagCounts: Record<string, number> = {}
  for (const r of recent30) {
    if (!r.status_tag) continue
    r.status_tag.split(/[、,，]+/).map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1
    })
  }
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  // Build a lookup: date → spiritual_log entry (latest per date)
  const logByDate: Record<string, typeof logEntries[number]> = {}
  for (const l of logEntries) {
    if (!logByDate[l.client_date]) logByDate[l.client_date] = l
  }

  // Timeline: use daily_alignments as backbone (ensures historical records show),
  // enrich with AI comfort + verse from spiritual_logs when available.
  // Deduplicate by date, keep only last 30 entries.
  const seenDates = new Set<string>()
  const timelineItems = records
    .filter(r => {
      if (seenDates.has(r.date)) return false
      seenDates.add(r.date)
      return true
    })
    .slice(0, 30)
    .map(r => {
      const rich = logByDate[r.date]
      return {
        id:          rich?.id ?? r.date,
        date:        r.date,
        mood:        rich?.mood || r.status_tag || '',
        ai_comfort:  rich?.ai_comfort  ?? null,
        bible_verse: rich?.bible_verse ?? null,
        bible_ref:   rich?.bible_ref   ?? null,
      }
    })

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <BarChart2 className="h-4 w-4 text-amber-500" />
          <h1 className="text-sm font-bold text-stone-900">灵命成长</h1>
          <span className="text-[11px] text-stone-400">近 90 天</span>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            首页
          </Link>
        </div>
      </header>

      <GlobalNotice />

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32 space-y-5">

        {/* ── 三格统计卡 ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '内室记录', value: `${total} 次`, emoji: '📖' },
            { label: '连续同行', value: `${streak} 天`, emoji: '🔥' },
            { label: '常见心境', value: topTag ?? (total === 0 ? '—' : '多样'), emoji: '🌿' },
          ].map(({ label, value, emoji }) => (
            <div key={label}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-100
                         bg-white/90 py-4 shadow-md shadow-amber-900/5 backdrop-blur-md">
              <span className="text-xl">{emoji}</span>
              <span className="text-base font-bold text-stone-900">{value}</span>
              <span className="text-[10px] font-medium text-stone-400">{label}</span>
            </div>
          ))}
        </div>

        {/* ── 近 30 天心境分布 ──────────────────── */}
        {Object.keys(tagCounts).length > 0 && (
          <div className="rounded-2xl border border-stone-100 bg-white/90 p-5 shadow-md shadow-amber-900/5 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                <Sprout className="h-4 w-4 text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-stone-900">近 30 天心境分布</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, count]) => {
                  const pct   = Math.round((count / recent30.length) * 100)
                  const emoji = TAG_EMOJI[tag] ?? '🌾'
                  return (
                    <div key={tag}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-600">{emoji} {tag}</span>
                        <span className="text-xs text-stone-400 tabular-nums">{count} 次 · {pct}%</span>
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
          </div>
        )}

        {/* ── 属灵回溯时间轴 ──────────────────── */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 p-5 shadow-md shadow-amber-900/5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
              <CalendarDays className="h-4 w-4 text-amber-500" />
            </div>
            <h2 className="text-sm font-bold text-stone-900">属灵回溯时间轴</h2>
            <span className="ml-auto text-[11px] text-stone-400">近 90 天</span>
          </div>

          {timelineItems.length === 0 ? (
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 px-4 py-5 text-center">
              <p className="text-sm font-medium text-amber-700">
                开始第一次内室记录，你的属灵轨迹就从今天开始扎根。
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {timelineItems.map((item, idx) => {
                const moodEmoji = item.mood
                  ? (TAG_EMOJI[item.mood.split(/[、,，]+/)[0]?.trim()] ?? '🌾')
                  : '🌾'
                const isLast = idx === timelineItems.length - 1

                return (
                  <div key={item.id} className="flex gap-3">
                    {/* 时间轴竖线 */}
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                                      bg-gradient-to-br from-amber-100 to-orange-100 text-base shadow-sm">
                        {moodEmoji}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-gradient-to-b from-amber-100 to-stone-100 my-1" style={{ minHeight: 24 }} />
                      )}
                    </div>

                    {/* 内容卡 */}
                    <div className="flex-1 pb-5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-bold text-stone-700">
                          {formatDateCN(item.date)}
                        </p>
                        {item.mood && (
                          <span className="shrink-0 text-xs font-medium text-stone-400">
                            {renderTagEmojis(item.mood)}
                          </span>
                        )}
                      </div>

                      {/* AI 属灵回应 — 仅提交后有 */}
                      {item.ai_comfort ? (
                        <p className="text-sm text-stone-600 leading-relaxed mb-2.5">
                          {item.ai_comfort}
                        </p>
                      ) : (
                        <p className="text-xs text-stone-300 italic mb-2">已在内室与祂相遇</p>
                      )}

                      {/* 经文 — 仅提交后有 */}
                      {item.bible_verse && (
                        <div className="rounded-xl border border-amber-100/80 bg-amber-50/60 px-3 py-3">
                          <p className="text-sm text-stone-600 italic leading-relaxed">
                            "{item.bible_verse}"
                          </p>
                          {item.bible_ref && (
                            <p className="mt-1.5 text-xs text-stone-400">—— {item.bible_ref}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {total > timelineItems.length && (
                <p className="pt-2 text-center text-xs text-stone-300">
                  还有更早的内室记录，共 {total} 次
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 属灵鼓励卡 ──────────────────────── */}
        <div className="rounded-2xl border border-amber-100/60 bg-gradient-to-br
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

        <DonationWidget pageKey="growth" />

      </main>

      <BottomNav />
    </div>
  )
}
