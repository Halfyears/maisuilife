import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { Wheat, BookOpen, Users, ChevronRight } from 'lucide-react'

export const metadata = { title: '麦穗喜乐' }

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: profile } = await db
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const today = new Date().toISOString().slice(0, 10)
  const { data: todayAlignment } = await supabase
    .from('daily_alignments')
    .select('status_tag')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  const firstName = profile?.display_name?.slice(0, 4) ?? '朋友'

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3.5">
          <Wheat className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="font-serif text-base font-black tracking-wide bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            麦穗喜乐
          </span>
          <span className="ml-auto text-xs text-stone-400">{formatDate(new Date())}</span>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-md px-5 pt-8 pb-32">

        {/* Greeting */}
        <div className="mb-8">
          <p className="text-sm font-medium text-stone-500">早安，{firstName}</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900 tracking-wide">
            {todayAlignment ? '今日已对齐 ✓' : '愿你今日平安'}
          </h1>
          {todayAlignment && (
            <p className="mt-1 text-sm text-stone-400">
              今日心境：{todayAlignment.status_tag} · 记录已安全交托
            </p>
          )}
        </div>

        {/* Primary entry cards */}
        <div className="flex flex-col gap-4">

          {/* Card 1: 内室记录 */}
          <Link href="/daily" className="group block">
            <div className="relative overflow-hidden rounded-2xl border border-stone-100/85 bg-white/90 p-6
                            shadow-md shadow-amber-900/5 backdrop-blur-md transition-all duration-300
                            hover:shadow-lg hover:border-amber-200/60 active:scale-[0.98]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-xl">
                      🌾
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">今日记录</p>
                      <p className="text-base font-bold text-stone-900">内室记录</p>
                    </div>
                  </div>
                  <p className="text-sm text-stone-500 leading-snug">
                    {todayAlignment
                      ? '今日已完成记录，感谢你的委身。'
                      : '选择今日心境，在主面前敞开心扉。'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-amber-400 transition-colors shrink-0 mt-1" />
              </div>

              {todayAlignment && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-amber-700">已完成</span>
                </div>
              )}
              {!todayAlignment && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300 animate-pulse" />
                  <span className="text-xs font-medium text-stone-500">等待今日记录</span>
                </div>
              )}

              {/* decorative gradient */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/5 via-transparent to-transparent" />
            </div>
          </Link>

          {/* Card 2: 麦穗团契 */}
          <Link href="/fellowship" className="group block">
            <div className="relative overflow-hidden rounded-2xl border border-stone-100/85 bg-white/90 p-6
                            shadow-md shadow-amber-900/5 backdrop-blur-md transition-all duration-300
                            hover:shadow-lg hover:border-stone-200 active:scale-[0.98]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50 text-xl">
                      👥
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">共同体</p>
                      <p className="text-base font-bold text-stone-900">麦穗团契</p>
                    </div>
                  </div>
                  <p className="text-sm text-stone-500 leading-snug">
                    查看弟兄姐妹的心境，在团体中彼此关怀。
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0 mt-1" />
              </div>

              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-stone-400/4 via-transparent to-transparent" />
            </div>
          </Link>

          {/* Card 3: Scripture of the day — decorative */}
          <div className="rounded-2xl border border-amber-100/60 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-5">
            <div className="flex items-start gap-3">
              <BookOpen className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1.5">今日经文</p>
                <p className="text-sm text-stone-700 leading-relaxed italic">
                  "你们要将一切的忧虑卸给神，因为他顾念你们。"
                </p>
                <p className="mt-2 text-xs text-stone-400">— 彼得前书 5:7</p>
              </div>
            </div>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}

function formatDate(d: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${days[d.getDay()]}`
}
