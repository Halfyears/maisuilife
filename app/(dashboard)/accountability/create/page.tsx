'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Target } from 'lucide-react'

const DAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]
const PRESET_CATEGORIES = [
  { value: 'prayer',        label: '🙏 祷告'   },
  { value: 'bible_reading', label: '📖 读经'   },
]

export default function CreateAccountabilityGroupPage() {
  const router = useRouter()
  const [name,       setName]       = useState('')
  const [goal,       setGoal]       = useState('')
  const [desc,       setDesc]       = useState('')
  const [cat,        setCat]        = useState('custom')
  const [customCat,  setCustomCat]  = useState('')
  const [editCustom, setEditCustom] = useState(false)
  const [days,  setDays]  = useState<number[]>([])
  const [time,  setTime]  = useState('')
  const [start, setStart] = useState('')
  const [end,   setEnd]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('请填写小组名称'); return }
    setSaving(true)
    setError(null)
    try {
      // goal_category: use customCat text if custom, else preset value
      const finalCat = cat === 'custom'
        ? (customCat.trim() || '自定义')
        : cat

      const res = await fetch('/api/accountability/groups', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:                  name.trim(),
          goal_title:            goal.trim() || undefined,
          goal_description:      desc.trim() || undefined,
          goal_category:         finalCat,
          schedule_days_of_week: days,
          schedule_time:         time || undefined,
          start_date:            start || undefined,
          end_date:              end   || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'error')
      router.push(`/accountability/${data.group.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">发起同行小组</h1>
          <Link
            href="/accountability"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-20">
        <form onSubmit={submit} className="space-y-5">

          {/* 基本信息 */}
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">小组信息</p>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">小组名称 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                placeholder="例：每日晨祷小队"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">同行目标</label>
              <input
                type="text"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                maxLength={255}
                placeholder="例：每天读经 15 分钟"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">目标说明（可选）</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                placeholder="简述目标或激励语…"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-2">目标类型</label>
              <div className="flex gap-2 flex-wrap items-center">
                {PRESET_CATEGORIES.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setCat(opt.value); setEditCustom(false) }}
                    className={[
                      'rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                      cat === opt.value
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-stone-200 text-stone-500 hover:border-amber-200',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setCat('custom'); setEditCustom(true) }}
                  className={[
                    'rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                    cat === 'custom'
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-stone-200 text-stone-500 hover:border-amber-200',
                  ].join(' ')}
                >
                  {cat === 'custom' && customCat.trim() ? `✨ ${customCat.trim()}` : '✨ 自定义'}
                </button>
              </div>
              {cat === 'custom' && editCustom && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customCat}
                    onChange={e => setCustomCat(e.target.value.slice(0, 20))}
                    placeholder="输入自定义类型名称…"
                    maxLength={20}
                    autoFocus
                    className="flex-1 rounded-xl border border-amber-300 bg-amber-50/50 px-3 py-2
                               text-xs text-stone-800 placeholder-stone-300
                               focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    type="button"
                    onClick={() => setEditCustom(false)}
                    className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                  >
                    确定
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 约定时间 */}
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">约定打卡时间</p>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-2">每周哪几天</label>
              <div className="flex gap-2 flex-wrap">
                {DAY_OPTIONS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={[
                      'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                      days.includes(d.value)
                        ? 'border-amber-400 bg-amber-400 text-white'
                        : 'border-stone-200 text-stone-500 hover:border-amber-200',
                    ].join(' ')}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">约定时间（可选）</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-600 block mb-1.5">开始日期</label>
                <input
                  type="date"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2
                             text-sm text-stone-800
                             focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 block mb-1.5">
                  结束日期
                  <span className="ml-1 font-normal text-stone-400">（留空=不设截止）</span>
                </label>
                <input
                  type="date"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2
                             text-sm text-stone-800
                             focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center">
              <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-2xl
                       bg-gradient-to-r from-amber-500 to-orange-500
                       py-3.5 text-sm font-bold text-white
                       shadow-md shadow-orange-500/20 hover:opacity-90
                       disabled:opacity-60 transition-opacity"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />创建中…</> : '🤝 发起同行小组'}
          </button>

          <p className="text-center text-xs text-stone-400 leading-relaxed">
            创建后会生成 6 位邀请码，<br />分享给任何你想同行的人。
          </p>
        </form>
      </main>
    </div>
  )
}
