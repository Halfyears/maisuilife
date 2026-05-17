'use client'

import { useState, useCallback, useTransition } from 'react'
import { Heart, CheckCircle2, Plus, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PrayerRequestItem } from '@/app/api/prayer/route'

interface PrayerSectionProps {
  fellowshipId:    string
  initialRequests: PrayerRequestItem[]
}

export function PrayerSection({ fellowshipId, initialRequests }: PrayerSectionProps) {
  const [requests,    setRequests]    = useState<PrayerRequestItem[]>(initialRequests)
  const [showForm,    setShowForm]    = useState(false)
  const [showResolved, setShowResolved] = useState(false)

  const active   = requests.filter(r => !r.is_resolved)
  const resolved = requests.filter(r => r.is_resolved)

  const handlePray = useCallback(async (id: string) => {
    // 乐观更新
    setRequests(prev => prev.map(r =>
      r.id !== id ? r : {
        ...r,
        i_committed:    true,
        i_prayed_today: true,
        pray_count:    r.i_committed ? r.pray_count : r.pray_count + 1,
        total_prayers: r.total_prayers + 1,
      }
    ))
    await fetch('/api/prayer/pray', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ request_id: id }),
    })
  }, [])

  const handleResolve = useCallback(async (id: string) => {
    setRequests(prev => prev.map(r => r.id !== id ? r : { ...r, is_resolved: true }))
    await fetch('/api/prayer/resolve', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ request_id: id }),
    })
  }, [])

  const handleCreated = useCallback((item: PrayerRequestItem) => {
    setRequests(prev => [item, ...prev])
    setShowForm(false)
  }, [])

  return (
    <section className="mt-6">
      {/* ── 标题栏 ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-stone-900">代祷需求</h2>
          {active.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {active.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50
                     px-3 py-1.5 text-xs font-semibold text-amber-700
                     hover:bg-amber-100 transition-colors active:scale-[0.98]"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? '取消' : '发起代祷'}
        </button>
      </div>

      {/* ── 发布表单 ─────────────────────────────────── */}
      {showForm && (
        <NewPrayerForm
          fellowshipId={fellowshipId}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── 代祷列表 ─────────────────────────────────── */}
      {active.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-stone-100 bg-white/80 px-5 py-6 text-center">
          <p className="text-sm text-stone-400">还没有代祷需求</p>
          <p className="mt-1 text-xs text-stone-300">点击「发起代祷」，让弟兄姐妹一同守望</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map(r => (
            <li key={r.id}>
              <PrayerCard
                item={r}
                onPray={handlePray}
                onResolve={handleResolve}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ── 已蒙恩的需求（折叠） ──────────────────────── */}
      {resolved.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowResolved(v => !v)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            {showResolved ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            已蒙恩的代祷 ({resolved.length})
          </button>
          {showResolved && (
            <ul className="flex flex-col gap-3 mt-3">
              {resolved.map(r => (
                <li key={r.id}>
                  <PrayerCard item={r} onPray={handlePray} onResolve={handleResolve} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// ── 单张代祷卡片 ──────────────────────────────────────────────────────
interface PrayerCardProps {
  item:      PrayerRequestItem
  onPray:    (id: string) => void
  onResolve: (id: string) => void
}

function PrayerCard({ item, onPray, onResolve }: PrayerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = !!item.content

  const dateLabel = (() => {
    const d = new Date(item.created_at)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  })()

  return (
    <article className={cn(
      'rounded-2xl border bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md transition-all',
      item.is_resolved
        ? 'border-green-100 bg-green-50/40'
        : item.is_self
          ? 'border-amber-200 bg-amber-50/30'
          : 'border-stone-100',
    )}>
      {/* ── 顶部：名字 + 日期 + 已蒙恩标记 ─── */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{item.is_anonymous ? '🫙' : '🙏'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate">
              {item.is_anonymous ? '匿名弟兄姐妹' : item.requester}
              {item.is_self && <span className="ml-1 text-[11px] text-amber-600 font-normal">(你)</span>}
            </p>
            <p className="text-[10px] text-stone-400">{dateLabel}</p>
          </div>
        </div>
        {item.is_resolved && (
          <span className="shrink-0 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            <CheckCircle2 className="h-3 w-3" /> 已蒙恩
          </span>
        )}
      </div>

      {/* ── 代祷事项标题 ─────────────────────── */}
      <p className="text-sm font-medium text-stone-700 leading-snug mb-1">{item.title}</p>

      {/* ── 详情（可展开）───────────────────── */}
      {hasContent && (
        <>
          {expanded && (
            <p className="text-xs text-stone-500 leading-relaxed mt-1 mb-2 whitespace-pre-wrap">
              {item.content}
            </p>
          )}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-amber-600 hover:text-amber-700 font-medium"
          >
            {expanded ? '收起详情' : '查看详情'}
          </button>
        </>
      )}

      {/* ── 代祷统计 + 按钮 ───────────────── */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100/80">
        <p className="text-[11px] text-stone-400">
          {item.pray_count > 0
            ? `已有 ${item.pray_count} 人承诺代祷 · 累计 ${item.total_prayers} 次`
            : '还没有人代祷，成为第一个吧'}
        </p>

        <div className="flex items-center gap-2">
          {/* 已蒙恩按钮（仅发布者看到，且未解决时） */}
          {item.is_self && !item.is_resolved && (
            <button
              type="button"
              onClick={() => onResolve(item.id)}
              className="rounded-xl border border-green-200 bg-green-50 px-3 py-1.5
                         text-[11px] font-semibold text-green-700 hover:bg-green-100
                         transition-colors active:scale-[0.98]"
            >
              已蒙恩
            </button>
          )}

          {/* 代祷按钮（非发布者，未解决时） */}
          {!item.is_resolved && (
            <button
              type="button"
              onClick={() => !item.i_prayed_today && onPray(item.id)}
              disabled={item.i_prayed_today}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.98]',
                item.i_prayed_today
                  ? 'border-amber-200 bg-amber-50 text-amber-600 cursor-default'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
              )}
            >
              {item.i_prayed_today ? '✓ 今日已代祷' : '🙏 为TA代祷'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

// ── 发布表单 ────────────────────────────────────────────────────────────
interface NewPrayerFormProps {
  fellowshipId: string
  onCreated:    (item: PrayerRequestItem) => void
  onCancel:     () => void
}

function NewPrayerForm({ fellowshipId, onCreated, onCancel }: NewPrayerFormProps) {
  const [title,       setTitle]       = useState('')
  const [content,     setContent]     = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isPending,   startTransition] = useTransition()
  const [error,       setError]       = useState('')

  const handleSubmit = () => {
    if (!title.trim()) { setError('请填写代祷事项'); return }
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/prayer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fellowship_id: fellowshipId, title, content, is_anonymous: isAnonymous }),
      })
      if (!res.ok) { setError('发送失败，请稍后再试'); return }
      const { id } = await res.json()
      const newItem: PrayerRequestItem = {
        id,
        is_self:      true,
        requester:    isAnonymous ? null : '你',
        is_anonymous: isAnonymous,
        title:        title.trim(),
        content:      content.trim() || null,
        is_resolved:  false,
        created_at:   new Date().toISOString(),
        pray_count:   0,
        total_prayers: 0,
        i_committed:  false,
        i_prayed_today: false,
      }
      onCreated(newItem)
    })
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 mb-4 space-y-3">
      <div>
        <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
          代祷事项 <span className="text-red-400">*</span>
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          placeholder="简短描述你的代祷需求，如"为父亲的病情代祷""
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5
                     text-sm text-stone-800 placeholder:text-stone-400
                     focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
          详细说明 <span className="text-stone-400 font-normal">（选填）</span>
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="分享更多背景，让弟兄姐妹更有针对地代祷…"
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5
                     text-sm text-stone-800 placeholder:text-stone-400 resize-none
                     focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
        />
      </div>

      {/* 匿名开关 */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <div
          onClick={() => setIsAnonymous(v => !v)}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            isAnonymous ? 'bg-amber-400' : 'bg-stone-200',
          )}
        >
          <span className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            isAnonymous ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </div>
        <span className="text-xs text-stone-600">
          {isAnonymous ? '匿名发布（弟兄姐妹看不到你的名字）' : '公开姓名（推荐，让代祷更有针对性）'}
        </span>
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !title.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl
                     bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                     py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20
                     disabled:opacity-50 transition-opacity active:scale-[0.99]"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          发起代祷
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5
                     text-sm text-stone-500 hover:bg-stone-50 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
