'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Target, Trash2 } from 'lucide-react'

const DAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]
const PRESET_CATEGORIES = [
  { value: 'prayer',        label: '🙏 祷告' },
  { value: 'bible_reading', label: '📖 读经' },
]
const PRESET_VALUES = new Set(['prayer', 'bible_reading'])

export default function AccountabilitySettingsPage({ params }: { params: { id: string } }) {
  const router  = useRouter()
  const groupId = params.id

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
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/accountability/group?id=${groupId}`)
      .then(r => r.json())
      .then(data => {
        if (data.group) {
          const g = data.group
          setName(g.name ?? '')
          setGoal(g.goal_title ?? '')
          setDesc(g.goal_description ?? '')
          // If saved value is a preset, use it; otherwise it's a custom label
          const savedCat = g.goal_category ?? 'custom'
          if (PRESET_VALUES.has(savedCat)) {
            setCat(savedCat)
          } else {
            setCat('custom')
            setCustomCat(savedCat === 'custom' ? '' : savedCat)
          }
          setDays(Array.isArray(g.schedule_days_of_week) ? g.schedule_days_of_week : [])
          setTime(g.schedule_time ?? '')
          setStart(g.start_date ?? '')
          setEnd(g.end_date ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [groupId])

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }

  async function save() {
    if (!name.trim()) { setError('请填写小组名称'); return }
    setSaving(true)
    setSaved(false)
    setError(null)
    const finalCat = cat === 'custom'
      ? (customCat.trim() || '自定义')
      : cat
    try {
      const res = await fetch('/api/accountability/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          group_id:              groupId,
          name:                  name.trim(),
          goal_title:            goal.trim() || null,
          goal_description:      desc.trim() || null,
          goal_category:         finalCat,
          schedule_days_of_week: days,
          schedule_time:         time  || null,
          start_date:            start || null,
          end_date:              end   || null,
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      router.refresh()
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">小组设置</h1>
          <Link
            href={`/accountability/${groupId}`}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-20 space-y-5">

        {/* 基本信息 */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">小组信息</p>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">小组名称 <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={100}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">同行目标</label>
            <input type="text" value={goal} onChange={e => setGoal(e.target.value)} maxLength={255} placeholder="例：每天读经 15 分钟"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">目标说明</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-2">目标类型</label>
            <div className="flex gap-2 flex-wrap items-center">
              {PRESET_CATEGORIES.map(opt => (
                <button key={opt.value} type="button" onClick={() => { setCat(opt.value); setEditCustom(false) }}
                  className={['rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                    cat === opt.value ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-500 hover:border-amber-200',
                  ].join(' ')}>
                  {opt.label}
                </button>
              ))}
              <button type="button" onClick={() => { setCat('custom'); setEditCustom(true) }}
                className={['rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                  cat === 'custom' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-500 hover:border-amber-200',
                ].join(' ')}>
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
                <button type="button" onClick={() => setEditCustom(false)}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors">
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
                <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                  className={['rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                    days.includes(d.value) ? 'border-amber-400 bg-amber-400 text-white' : 'border-stone-200 text-stone-500 hover:border-amber-200',
                  ].join(' ')}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">约定时间</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent" />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">开始日期</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">结束日期</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent" />
              <p className="mt-1 text-[11px] text-stone-400">留空表示不设截止日期</p>
            </div>
          </div>
        </div>

        {error && <p className="text-center text-xs text-red-600">{error}</p>}
        {saved && <p className="text-center text-xs text-green-600">✓ 设置已保存</p>}

        <button type="button" onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:opacity-90 disabled:opacity-60 transition-opacity">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />保存中…</> : <><Save className="h-4 w-4" />保存设置</>}
        </button>
      </main>
    </div>
  )
}
