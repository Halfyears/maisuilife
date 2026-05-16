import { redirect } from 'next/navigation'
import { BarChart2, Sprout, BookOpen, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'

export const metadata = { title: '灵命成长 — 麦穗喜乐' }
export const revalidate = 60

const TAG_EMOJI: Record<string, string> = {
  '感恩': '🙏', '平安': '🕊️', '疲惫': '🌙', '干渴': '🌿', '混乱': '🌊',
}

// 将多选心境字符串解析为 emoji 列表
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

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
  const today  = new Date().toISOString().slice(0, 10)
  // 仅从今天或昨天开始计算连续天数
  if (sorted[0] !== today && sorted[0] !== (() => {
    const y = new Date(); y.setDate(y.getDate() - 1); return y.toISOString().slice(0, 10)
  })()) return 0
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 读取近 90 天的完整内室记录（含日期、心境、紧急标记）
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: alignments } = await supabase
    .from('daily_alignments')
    .select('id, status_tag, date, is_urgent, created_at')
    .eq('user_id', user.id)
    .gte('date', ninetyDaysAgo.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  const records  = alignments ?? []
  const total    = records.length
  const streak   = computeStreak(records.map(r => r.date))

  // 近 30 天统计
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recent30 = records.filter(r => r.date >= thirtyDaysAgo.toISOString().slice(0, 10))

  // 心境计数（支持多选标签）
  const tagCounts: Record<string, number> = {}
  for (const r of recent30) {
    if (!r.status_tag) continue
    r.status_tag.split(/[、,，]+/).map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1
    })
  }
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <BarChart2 className="h-4 w-4 text-amber-500" />
          <h1 className="text-sm font-bold text-stone-900">灵命成长</h1>
          <span className="ml-auto text-[11px] text-stone-400">近 90 天</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32 space-y-5">

        {/* ── 三格统计卡 ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '内室记录', value: `${total} 天`, emoji: '📖' },
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
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
              <CalendarDays className="h-4 w-4 text-amber-500" />
            </div>
            <h2 className="text-sm font-bold text-stone-900">属灵回溯时间轴</h2>
            <span className="ml-auto text-[11px] text-stone-400">近 90 天</span>
          </div>

          {records.length === 0 ? (
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 px-4 py-5 text-center">
              <p className="text-sm font-medium text-amber-700">
                开始第一次内室记录，你的属灵轨迹就从今天开始扎根。
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {records.slice(0, 20).map((record, idx) => (
                <div key={record.id} className="flex gap-3">
                  {/* 时间轴竖线 */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                                    bg-gradient-to-br from-amber-100 to-orange-100 text-sm">
                      {record.status_tag
                        ? (TAG_EMOJI[record.status_tag.split(/[、,，]+/)[0]?.trim()] ?? '🌾')
                        : '🌾'
                      }
                    </div>
                    {idx < records.slice(0, 20).length - 1 && (
                      <div className="w-px flex-1 bg-stone-100 my-1" />
                    )}
                  </div>

                  {/* 内容卡 */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-stone-700">
                        {formatDateCN(record.date)}
                      </p>
                      {record.is_urgent && (
                        <span className="shrink-0 rounded-full bg-red-50 border border-red-100
                                         px-2 py-0.5 text-[10px] font-semibold text-red-500">
                          代祷
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {record.status_tag
                        ? renderTagEmojis(record.status_tag)
                        : '静默交托'}
                    </p>
                  </div>
                </div>
              ))}

              {records.length > 20 && (
                <p className="pt-2 text-center text-[11px] text-stone-300">
                  还有 {records.length - 20} 条历史记录
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

      </main>

      <BottomNav />
    </div>
  )
}
