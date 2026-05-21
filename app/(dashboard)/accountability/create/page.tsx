'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Target } from 'lucide-react'
import { DAILY_PRESET_CATEGORIES, VIGIL_PRESET_CATEGORIES, isDailyPreset, isVigilPreset } from '@/lib/accountability'

const DAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

type GroupType = 'daily' | 'vigil'

export default function CreateAccountabilityGroupPage() {
  const router = useRouter()

  // Step 0: type selection; step 1: form
  const [step,     setStep]     = useState<0 | 1>(0)
  const [groupType, setGroupType] = useState<GroupType>('daily')

  const [name,       setName]       = useState('')
  const [goal,       setGoal]       = useState('')
  const [desc,       setDesc]       = useState('')
  const [cat,        setCat]        = useState('')
  const [customCat,  setCustomCat]  = useState('')
  const [editCustom, setEditCustom] = useState(false)
  const [days,  setDays]  = useState<number[]>([])
  const [time,  setTime]  = useState('')
  const [start, setStart] = useState('')
  const [end,   setEnd]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function pickType(t: GroupType) {
    setGroupType(t)
    setCat('')
    setCustomCat('')
    setEditCustom(false)
    setStep(1)
  }

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }

  function currentPresets() {
    return groupType === 'vigil' ? VIGIL_PRESET_CATEGORIES : DAILY_PRESET_CATEGORIES
  }

  function isPreset(v: string) {
    return groupType === 'vigil' ? isVigilPreset(v) : isDailyPreset(v)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('请填写小组名称'); return }
    setSaving(true)
    setError(null)
    try {
      const finalCat = cat === 'custom'
        ? (customCat.trim() || '自定义')
        : (cat || (groupType === 'vigil' ? 'vigil_custom' : 'custom'))

      const body: Record<string, unknown> = {
        name:             name.trim(),
        goal_title:       goal.trim() || undefined,
        goal_description: desc.trim() || undefined,
        goal_category:    finalCat,
        group_type:       groupType,
      }

      if (groupType === 'daily') {
        body.schedule_days_of_week = days
        body.schedule_time         = time  || undefined
        body.start_date            = start || undefined
        body.end_date              = end   || undefined
      }

      const res  = await fetch('/api/accountability/groups', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'error')
      router.push(`/accountability/${data.group.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试')
      setSaving(false)
    }
  }

  // ── Step 0: 类型选择 ───────────────────────────────────────────
  if (step === 0) {
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

        <main className="flex-1 mx-auto w-full max-w-md px-4 pt-8 pb-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-5 px-1">
            选择同行类型
          </p>

          <div className="flex flex-col gap-4">
            {/* 日常同行 */}
            <button
              type="button"
              onClick={() => pickType('daily')}
              className="w-full text-left rounded-2xl border border-stone-100 bg-white/90 px-5 py-5
                         shadow-sm hover:border-amber-300 hover:shadow-md transition-all active:scale-[0.99] group"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center text-xl shrink-0">
                  🌿
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                    日常同行
                  </p>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    读经、祷告、晨祷、聚会、徒步、旅行…<br />
                    约定打卡时间，彼此激励，互相记挂。
                  </p>
                  <p className="text-[11px] text-amber-600 mt-2 font-medium">有约定时间 · 每日打卡</p>
                </div>
              </div>
            </button>

            {/* 守望互助 */}
            <button
              type="button"
              onClick={() => pickType('vigil')}
              className="w-full text-left rounded-2xl border border-stone-100 bg-white/90 px-5 py-5
                         shadow-sm hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.99] group"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
                  🕯️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-900 group-hover:text-slate-700 transition-colors">
                    守望互助
                  </p>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    重病、ICU、丧亲、重大变故、家庭变故…<br />
                    安静同在，让肢体知道有人在守望。
                  </p>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">无打卡 · 安静守望 · 微互动</p>
                </div>
              </div>
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-stone-400 leading-relaxed">
            类型创建后不可更改。<br />
            两种类型都可以跨团契邀请任何人加入。
          </p>
        </main>
      </div>
    )
  }

  // ── Step 1: 填写表单 ──────────────────────────────────────────
  const isVigil = groupType === 'vigil'

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <span className="text-base shrink-0">{isVigil ? '🕯️' : '🌿'}</span>
          <h1 className="text-sm font-bold text-stone-900 flex-1">
            {isVigil ? '发起守望互助小组' : '发起日常同行小组'}
          </h1>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            重选
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-20">
        <form onSubmit={submit} className="space-y-5">

          {/* 基本信息 */}
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">小组信息</p>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">
                小组名称 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                placeholder={isVigil ? '例：为志远哥哥守望' : '例：每日晨祷小队'}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">
                {isVigil ? '守望情况简述' : '同行目标'}
              </label>
              <input
                type="text"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                maxLength={255}
                placeholder={isVigil ? '例：确诊 ICU，需要守望祷告' : '例：每天读经 15 分钟'}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">
                {isVigil ? '背景说明（可选）' : '目标说明（可选）'}
              </label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                placeholder={isVigil ? '可补充背景，或留白…' : '简述目标或激励语…'}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                           text-sm text-stone-800 placeholder-stone-300
                           focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-2">
                {isVigil ? '守望类别' : '目标类型'}
              </label>
              <div className="flex gap-2 flex-wrap items-center">
                {currentPresets().map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setCat(opt.value); setEditCustom(false) }}
                    className={[
                      'rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                      cat === opt.value
                        ? (isVigil
                          ? 'border-slate-400 bg-slate-50 text-slate-800'
                          : 'border-amber-400 bg-amber-50 text-amber-800')
                        : 'border-stone-200 text-stone-500 hover:border-stone-300',
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
                      ? (isVigil
                        ? 'border-slate-400 bg-slate-50 text-slate-800'
                        : 'border-amber-400 bg-amber-50 text-amber-800')
                      : 'border-stone-200 text-stone-500 hover:border-stone-300',
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
                    placeholder="输入自定义类别名称…"
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

          {/* 约定打卡时间（仅日常同行） */}
          {!isVigil && (
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

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1.5">开始日期</label>
                  <input
                    type="date"
                    value={start}
                    onChange={e => setStart(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
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
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5
                               text-sm text-stone-800
                               focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                  />
                  <p className="mt-1 text-[11px] text-stone-400">留空表示不设截止日期</p>
                </div>
              </div>
            </div>
          )}

          {/* 守望互助说明 */}
          {isVigil && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                🕯️ 守望互助小组没有打卡环节。<br />
                肢体每天点击"今日守望"登记同在，彼此知道有人在默默守望。<br />
                对方只会看到守望人数，不会看到具体名字。
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center">
              <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className={[
              'w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white',
              'shadow-md hover:opacity-90 disabled:opacity-60 transition-opacity',
              isVigil
                ? 'bg-slate-700 shadow-slate-700/15 hover:bg-slate-800'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/20',
            ].join(' ')}
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />创建中…</>
              : isVigil ? '🕯️ 发起守望互助小组' : '🌿 发起日常同行小组'}
          </button>

          <p className="text-center text-xs text-stone-400 leading-relaxed">
            创建后会生成 6 位邀请码，<br />
            分享给任何你想邀请的人。
          </p>
        </form>
      </main>
    </div>
  )
}
