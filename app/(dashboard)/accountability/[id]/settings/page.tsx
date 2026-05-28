'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, StopCircle, Users, UserMinus } from 'lucide-react'
import { DAILY_PRESET_CATEGORIES, VIGIL_PRESET_CATEGORIES } from '@/lib/accountability'

interface Member {
  user_id:      string
  display_name: string
  status:       string
}

const DAY_OPTIONS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

const ALL_PRESET_VALUES = new Set([
  ...DAILY_PRESET_CATEGORIES.map(c => c.value),
  ...VIGIL_PRESET_CATEGORIES.map(c => c.value),
])

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
  const [groupType, setGroupType] = useState<'daily' | 'vigil'>('daily')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [ending,    setEnding]    = useState(false)
  // 成员管理
  const [members,       setMembers]       = useState<Member[]>([])
  const [removingId,    setRemovingId]    = useState<string | null>(null)
  const [removeError,   setRemoveError]   = useState<string | null>(null)
  const [organizer_id,  setOrganizerId]   = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/accountability/group?id=${groupId}`).then(r => r.json()),
      fetch(`/api/accountability/groups/${groupId}/members`).then(r => r.json()),
    ]).then(([groupData, membersData]) => {
      if (groupData.group) {
        const g = groupData.group
        setName(g.name ?? '')
        setGoal(g.goal_title ?? '')
        setDesc(g.goal_description ?? '')
        setGroupType(g.group_type === 'vigil' ? 'vigil' : 'daily')
        setOrganizerId(g.organizer_id ?? '')
        const savedCat = g.goal_category ?? 'custom'
        if (ALL_PRESET_VALUES.has(savedCat)) {
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
      if (Array.isArray(membersData.members)) {
        setMembers(membersData.members)
      }
    }).finally(() => setLoading(false))
  }, [groupId])

  async function removeMember(userId: string, displayName: string) {
    if (!confirm(`确认移除成员「${displayName}」？移除后将通过推送通知告知对方。`)) return
    setRemovingId(userId)
    setRemoveError(null)
    try {
      const res  = await fetch(`/api/accountability/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = {
          forbidden:             '无权操作',
          cannot_remove_organizer: '不能移除召集人',
          already_removed:       '该成员已被移除',
          member_not_found:      '成员不存在',
        }
        setRemoveError(msgs[data.error] ?? '移除失败，请重试')
        return
      }
      // 本地更新成员列表
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch {
      setRemoveError('网络错误，请重试')
    } finally {
      setRemovingId(null)
    }
  }

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }

  async function endGroup() {
    if (!confirm('确认结束此小组？状态将变更为「已结束」，成员记录保留。')) return
    setEnding(true)
    try {
      await fetch(`/api/accountability/groups/${groupId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      })
      router.push('/accountability')
    } catch { setError('操作失败') }
    finally   { setEnding(false) }
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
          <span className="text-base shrink-0">{groupType === 'vigil' ? '🕊️' : '🌿'}</span>
          <h1 className="text-sm font-bold text-stone-900 flex-1">
            {groupType === 'vigil' ? '守望相助设置' : '同行小组设置'}
          </h1>
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">小组信息</p>
            <span className={[
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              groupType === 'vigil'
                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200',
            ].join(' ')}>
              {groupType === 'vigil' ? '🕊️ 守望相助' : '🌿 同行小组'}
            </span>
          </div>

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
              {(groupType === 'vigil' ? VIGIL_PRESET_CATEGORIES : DAILY_PRESET_CATEGORIES).map(opt => (
                <button key={opt.value} type="button" onClick={() => { setCat(opt.value); setEditCustom(false) }}
                  className={[
                    'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                    cat === opt.value
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50/50',
                  ].join(' ')}>
                  {opt.label}
                </button>
              ))}
              <button type="button" onClick={() => { setCat('custom'); setEditCustom(true) }}
                className={[
                  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                  cat === 'custom'
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50/50',
                ].join(' ')}>
                ✨ {cat === 'custom' && customCat.trim() ? customCat.trim() : '自定义'}
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
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            {groupType === 'vigil' ? '同心守望约定' : '约定打卡时间'}
          </p>

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
            <label className="text-xs font-medium text-stone-600 block mb-1.5">
              {groupType === 'vigil' ? '同心守望时刻（可选）' : '约定时间'}
            </label>
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
              <p className="mt-1 text-[11px] text-stone-400">
                {groupType === 'vigil'
                  ? '守望可以无限期，也可设一个阶段目标'
                  : '留空表示不设截止日期'}
              </p>
            </div>
          </div>
        </div>

        {/* 成员管理 */}
        {members.length > 0 && (
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-stone-400 shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                成员管理（{members.length} 人）
              </p>
            </div>
            {removeError && (
              <p className="text-xs text-red-600">{removeError}</p>
            )}
            <div className="divide-y divide-stone-50">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">{m.display_name}</p>
                    {m.user_id === organizer_id && (
                      <p className="text-[10px] text-amber-600 font-semibold">召集人</p>
                    )}
                  </div>
                  {m.user_id !== organizer_id && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.user_id, m.display_name)}
                      disabled={removingId !== null}
                      className="shrink-0 flex items-center gap-1 rounded-xl border border-stone-200
                                 px-2.5 py-1.5 text-xs font-medium text-stone-400
                                 hover:border-red-200 hover:text-red-500 hover:bg-red-50
                                 disabled:opacity-50 transition-colors"
                      aria-label={`移除 ${m.display_name}`}
                    >
                      {removingId === m.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <UserMinus className="h-3 w-3" />
                      }
                      移除
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              移除后系统将推送通知告知对方，其历史打卡记录完整保留。
            </p>
          </div>
        )}

        {error && <p className="text-center text-xs text-red-600">{error}</p>}
        {saved && <p className="text-center text-xs text-green-600">✓ 设置已保存</p>}

        <button type="button" onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:opacity-90 disabled:opacity-60 transition-opacity">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />保存中…</> : <><Save className="h-4 w-4" />保存设置</>}
        </button>

        {/* 危险操作 */}
        <div className="rounded-2xl border border-red-100 bg-red-50/50 px-5 py-4 space-y-3">
          <p className="text-xs font-semibold text-red-700">危险操作</p>
          <button type="button" onClick={endGroup} disabled={ending}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-200
                       bg-white py-2.5 text-sm font-bold text-orange-600
                       hover:bg-orange-50 disabled:opacity-50 transition-colors">
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
            结束小组
          </button>
          <p className="text-[11px] text-orange-400">结束后状态变更为「已结束」，所有成员记录完整保留，可由管理员恢复。</p>
        </div>
      </main>
    </div>
  )
}
