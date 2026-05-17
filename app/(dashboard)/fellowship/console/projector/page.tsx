import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const metadata  = { title: '投屏 — 麦穗喜乐' }
export const revalidate = 30  // re-fetch every 30s for live display

/**
 * 投屏页 — 极简全屏，适合投影仪展示。
 * 显示今日状态词云（仅聚合数字，无人名）。
 * 背景使用燕麦色，大字体，浅色调。
 */
export default async function ProjectorPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createServiceClient()

  // Leader's fellowship
  const { data: fellowship } = await db
    .from('fellowships')
    .select('id, name')
    .eq('leader_id', user.id)
    .single()

  if (!fellowship) redirect('/fellowship/console')

  // All members
  const { data: members } = await db
    .from('fellowship_members')
    .select('user_id')
    .eq('fellowship_id', fellowship.id)

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
  const today = new Date().toISOString().slice(0, 10)

  // Today's status_tag distribution (no content, no names)
  const { data: alignments } = await db
    .from('daily_alignments')
    .select('status_tag')
    .in('user_id', memberIds)
    .eq('date', today)
    .eq('is_visible', true)

  // Aggregate
  const counts: Record<string, number> = {}
  ;(alignments ?? []).forEach((a: { status_tag: string }) => {
    counts[a.status_tag] = (counts[a.status_tag] ?? 0) + 1
  })

  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a)

  const today_zh = new Date().toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    // Full-screen oatmeal — no nav, no sidebar
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-12 px-8"
      style={{ backgroundColor: '#F4F1EA' }}
    >
      {/* Fellowship name */}
      <div className="text-center">
        <p className="text-base font-medium tracking-widest text-stone-400 uppercase">
          {fellowship.name}
        </p>
        <p className="mt-1 text-sm text-stone-400">{today_zh}</p>
      </div>

      {/* Status word cloud — large, centered, no names */}
      {entries.length === 0 ? (
        <p className="text-4xl font-light text-stone-400">今日尚无分享</p>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {entries.map(([tag, count]) => (
            <div key={tag} className="flex items-baseline gap-4">
              <span
                className="font-serif font-bold text-stone-700"
                style={{ fontSize: `${Math.max(3, 2 + count)}rem`, lineHeight: 1.1 }}
              >
                {tag}
              </span>
              <span className="text-2xl font-light text-stone-400 tabular-nums">
                {count} 人
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {total > 0 && (
        <p className="text-lg text-stone-400">
          共 {total} 位同行者已对齐
        </p>
      )}

      {/* Subtle brand mark */}
      <p className="absolute bottom-6 text-xs tracking-widest text-stone-300">
        麦穗喜乐 · 微光同行
      </p>
    </div>
  )
}
