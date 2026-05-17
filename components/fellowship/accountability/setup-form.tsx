'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'

const DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

const CATEGORY_OPTIONS = [
  { value: 'prayer',       label: '🙏 祷告' },
  { value: 'bible_reading',label: '📖 读经' },
  { value: 'custom',       label: '✨ 自定义' },
]

interface Fellowship {
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
}

export function AccountabilitySetupForm({ fellowship }: { fellowship: Fellowship }) {
  const router  = useRouter()
  const [type,  setType]  = useState<'standard' | 'accountability'>(fellowship.fellowship_type ?? 'standard')
  const [title, setTitle] = useState(fellowship.goal_title ?? '')
  const [desc,  setDesc]  = useState(fellowship.goal_description ?? '')
  const [cat,   setCat]   = useState<string>(fellowship.goal_category ?? 'custom')
  const [start, setStart] = useState(fellowship.goal_start_date ?? '')
  const [end,   setEnd]   = useState(fellowship.goal_end_date ?? '')
  const [days,  setDays]  = useState<number[]>(
    Array.isArray(fellowship.schedule_days_of_week) ? fellowship.schedule_days_of_week : []
  )
  const [time,  setTime]  = useState(fellowship.schedule_time ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/fellowship/accountability/setup', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fellowship_id:         fellowship.id,
          fellowship_type:       type,
          goal_title:            title.trim() || null,
          goal_description:      desc.trim() || null,
          goal_category:         cat || null,
          goal_start_date:       start || null,
          goal_end_date:         end   || null,
          schedule_days_of_week: days,
          schedule_time:         time  || null,
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

  return (
    <div className="space-y-5">
      {/* 模式切换 */}
      <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">团契模式</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('standard')}
            className={[
              'rounded-xl border-2 py-3 text-sm font-bold transition-all',
              type === 'standard'
                ? 'border-amber-400 bg-amber-50 text-amber-800'
                : 'border-stone-200 text-stone-500 hover:border-stone-300',
            ].join(' ')}
          >
            🌾 常规团契
          </button>
          <button
            type="button"
            onClick={() => setType('accountability')}
            className={[
              'rounded-xl border-2 py-3 text-sm font-bold transition-all',
              type === 'accountability'
                ? 'border-amber-400 bg-amber-50 text-amber-800'
                : 'border-stone-200 text-stone-500 hover:border-stone-300',
            ].join(' ')}
          >
            🤝 同行打卡
          </button>
        </div>
      </div>

      {type === 'accountability' && (
        <>
          {/* 目标设置 */}
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">同行目标</p>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">目标名称</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={255}
                placeholder="例：每日读经 10 分钟"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">目标描述（可选）</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                placeholder="简述目标内容…"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent
                           resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">目标类型</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCat(opt.value)}
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
              </div>
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
                <label className="text-xs font-medium text-stone-600 block mb-1.5">结束日期</label>
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

          {/* 约定时间 */}
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">约定打卡时间</p>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-2">约定日期</label>
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
          </div>
        </>
      )}

      {error && <p className="text-center text-xs text-red-600">{error}</p>}
      {saved && <p className="text-center text-xs text-green-600">✓ 设置已保存</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-2xl
                   bg-gradient-to-r from-amber-500 to-orange-500
                   py-3.5 text-sm font-bold text-white
                   shadow-md shadow-orange-500/20 hover:opacity-90
                   disabled:opacity-60 transition-opacity"
      >
        {saving
          ? <><Loader2 className="h-4 w-4 animate-spin" />保存中…</>
          : <><Save className="h-4 w-4" />保存设置</>
        }
      </button>
    </div>
  )
}
