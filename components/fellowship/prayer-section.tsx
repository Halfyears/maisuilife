'use client'

import { useState, useCallback, useTransition, useEffect, useRef } from 'react'
import { Heart, CheckCircle2, Plus, X, Loader2, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PrayerRequestItem } from '@/app/api/prayer/route'

interface PrayerSectionProps {
  fellowshipId:    string
  initialRequests: PrayerRequestItem[]
}

export function PrayerSection({ fellowshipId, initialRequests }: PrayerSectionProps) {
  const [requests,     setRequests]     = useState<PrayerRequestItem[]>(initialRequests)
  const [showForm,     setShowForm]     = useState(false)
  const [showResolved, setShowResolved] = useState(false)

  const active   = requests.filter(r => !r.is_resolved)
  const resolved = requests.filter(r => r.is_resolved)

  const handlePrayed = useCallback((id: string) => {
    setRequests(prev => prev.map(r =>
      r.id !== id ? r : {
        ...r,
        i_committed:    true,
        i_prayed_today: true,
        pray_count:     r.i_committed ? r.pray_count : r.pray_count + 1,
        total_prayers:  r.total_prayers + 1,
      }
    ))
    fetch('/api/prayer/pray', {
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

      {showForm && (
        <NewPrayerForm
          fellowshipId={fellowshipId}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {active.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-stone-100 bg-white/80 px-5 py-6 text-center">
          <p className="text-sm text-stone-400">还没有代祷需求</p>
          <p className="mt-1 text-xs text-stone-300">点击「发起代祷」，让弟兄姐妹一同守望</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map(r => (
            <li key={r.id}>
              <PrayerCard item={r} onPrayed={handlePrayed} onResolve={handleResolve} />
            </li>
          ))}
        </ul>
      )}

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
                  <PrayerCard item={r} onPrayed={handlePrayed} onResolve={handleResolve} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// ── 代祷流程：idle → composing / silent → done ──────────────────────
type PrayMode = 'idle' | 'composing' | 'silent' | 'done'

function PrayerCard({
  item,
  onPrayed,
  onResolve,
}: {
  item:      PrayerRequestItem
  onPrayed:  (id: string) => void
  onResolve: (id: string) => void
}) {
  const [expanded,   setExpanded]   = useState(false)
  const [prayMode,   setPrayMode]   = useState<PrayMode>('idle')
  const [prayText,   setPrayText]   = useState('')
  const [countdown,  setCountdown]  = useState(8)
  const [silentDone, setSilentDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 启动静默倒计时
  useEffect(() => {
    if (prayMode !== 'silent') return
    setCountdown(8)
    setSilentDone(false)
    timerRef.current = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) {
          clearInterval(timerRef.current!)
          setSilentDone(true)
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [prayMode])

  function completePrayer() {
    setPrayMode('done')
    onPrayed(item.id)
  }

  const alreadyPrayed = item.i_prayed_today || prayMode === 'done'
  const hasContent    = !!item.content

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

      {/* ── 顶部：名字 + 日期 ──────────────────────── */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{item.is_anonymous ? '🫙' : '🙏'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate">
              {item.is_self
                ? <span>{item.requester && item.requester !== '你' ? item.requester : ''}<span className={cn('text-amber-600 font-normal text-[11px]', item.requester && item.requester !== '你' && 'ml-1')}>（你）</span></span>
                : item.is_anonymous ? '匿名弟兄姐妹' : item.requester
              }
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

      {/* ── 代祷事项 ───────────────────────────────── */}
      <p className="text-sm font-medium text-stone-700 leading-snug mb-1">{item.title}</p>

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

      {/* ── 代祷统计 ────────────────────────────────── */}
      <p className="text-[11px] text-stone-400 mt-3">
        {item.pray_count > 0
          ? `已有 ${item.pray_count} 人承诺代祷 · 累计 ${item.total_prayers} 次`
          : '还没有人代祷，成为第一个吧'}
      </p>

      {/* ── 互动区 ──────────────────────────────────── */}
      {!item.is_resolved && (
        <div className="mt-3 pt-3 border-t border-stone-100/80">

          {/* 已代祷状态 */}
          {alreadyPrayed && (
            <p className="text-center text-xs text-amber-600 font-medium">✓ 今日已为TA代祷</p>
          )}

          {/* 发布者：低调的"已蒙恩"入口 */}
          {item.is_self && (
            <p className="text-center">
              <button
                type="button"
                onClick={() => onResolve(item.id)}
                className="text-[11px] text-stone-400 hover:text-green-600 underline underline-offset-2 transition-colors"
              >
                祷告已蒙应允？点此标记
              </button>
            </p>
          )}

          {/* 他人代祷流程 */}
          {!item.is_self && !alreadyPrayed && (
            <>
              {/* ── idle: 展示两个入口按钮 ─── */}
              {prayMode === 'idle' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrayMode('composing')}
                    className="flex-1 rounded-xl border border-amber-300 bg-amber-50 py-2.5
                               text-xs font-bold text-amber-800 hover:bg-amber-100
                               transition-colors active:scale-[0.98]"
                  >
                    🙏 为TA代祷
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrayMode('silent')}
                    className="rounded-xl border border-stone-200 bg-white px-4 py-2.5
                               text-xs text-stone-500 hover:border-stone-300 hover:bg-stone-50
                               transition-colors active:scale-[0.98]"
                  >
                    静默
                  </button>
                </div>
              )}

              {/* ── composing: 文字代祷区 ─────── */}
              {prayMode === 'composing' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    把你此刻对TA的代祷写下来——哪怕只是一句话。
                    <span className="text-stone-400">（这段文字只有你看得到）</span>
                  </p>
                  <textarea
                    value={prayText}
                    onChange={e => setPrayText(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="主啊，我为TA的……祈求你……"
                    className="w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2.5
                               text-sm text-stone-700 placeholder:text-stone-400 resize-none
                               focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { if (prayText.trim()) completePrayer() }}
                      disabled={!prayText.trim()}
                      className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                                 py-2.5 text-xs font-bold text-white shadow-sm
                                 disabled:opacity-40 transition-opacity active:scale-[0.98]"
                    >
                      献上代祷
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrayMode('idle')}
                      className="rounded-xl border border-stone-200 px-4 py-2.5
                                 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* ── silent: 静默代祷空间 ──────── */}
              {prayMode === 'silent' && (
                <div className="flex flex-col items-center gap-4 py-3">
                  {/* 脉冲圆圈 */}
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-16 w-16 rounded-full bg-amber-200/60 animate-ping" style={{ animationDuration: '2s' }} />
                    <span className="absolute h-12 w-12 rounded-full bg-amber-200/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl">
                      🙏
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 text-center leading-relaxed max-w-[180px]">
                    请在心中为TA默祷片刻<br />
                    <span className="text-stone-400">你的存在本身就是祝福</span>
                  </p>
                  <button
                    type="button"
                    onClick={completePrayer}
                    disabled={!silentDone}
                    className={cn(
                      'rounded-xl px-6 py-2.5 text-xs font-bold transition-all',
                      silentDone
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm active:scale-[0.98]'
                        : 'border border-stone-200 text-stone-400 cursor-default',
                    )}
                  >
                    {silentDone ? '完成代祷' : `请稍候 ${countdown} 秒…`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrayMode('idle')}
                    className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    返回
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </article>
  )
}

// ── 发布代祷表单 ─────────────────────────────────────────────────────
function NewPrayerForm({
  fellowshipId,
  onCreated,
  onCancel,
}: {
  fellowshipId: string
  onCreated:    (item: PrayerRequestItem) => void
  onCancel:     () => void
}) {
  const [title,        setTitle]       = useState('')
  const [content,      setContent]     = useState('')
  const [isAnonymous,  setIsAnonymous] = useState(false)
  const [isPending,    startTransition] = useTransition()
  const [error,        setError]       = useState('')

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
      onCreated({
        id,
        is_self:       true,
        requester:     isAnonymous ? null : '',
        is_anonymous:  isAnonymous,
        title:         title.trim(),
        content:       content.trim() || null,
        is_resolved:   false,
        created_at:    new Date().toISOString(),
        pray_count:    0,
        total_prayers: 0,
        i_committed:   false,
        i_prayed_today: false,
      })
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
          placeholder="简短描述你的代祷需求，如：为父亲的病情代祷"
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

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <div
          onClick={() => setIsAnonymous(v => !v)}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors cursor-pointer',
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
