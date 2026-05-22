'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { VigilPresence } from '@/types'

interface Props {
  groupId:          string
  myPresence:       VigilPresence | null
  initialPresences: VigilPresence[]
  memberCount:      number
  myUserId:         string
}

export function VigilPanel({ groupId, myPresence, initialPresences, memberCount, myUserId }: Props) {
  const [note,      setNote]      = useState(myPresence?.note ?? '')
  const [loading,   setLoading]   = useState(false)
  const [confirmed, setConfirmed] = useState(!!myPresence)
  const [presences, setPresences] = useState<VigilPresence[]>(initialPresences)
  const [error,     setError]     = useState<string | null>(null)

  async function handlePresence() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accountability/vigil', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ group_id: groupId, note: note.trim() || null }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPresences(data.today_presences)
      setConfirmed(true)
    } catch {
      setError('守望登记失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const watchingCount = presences.length

  return (
    <div className="space-y-4">

      {/* ── 守望计数 ─────────────────────────────────── */}
      <div className="rounded-2xl border border-violet-200/60 overflow-hidden shadow-sm"
        style={{ background: 'linear-gradient(135deg, #fdf4ff 0%, #fff8ee 60%, #fef3e2 100%)' }}>

        {/* 顶部金色光带 */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #c084fc, #d4af37, #c084fc)' }} />

        <div className="px-5 py-7 text-center">
          {/* 和平鸽 — 放大，有光晕 */}
          <div className="relative mx-auto w-fit mb-5">
            {/* 外光晕 */}
            <div className={[
              'absolute inset-0 rounded-full blur-xl transition-all duration-700',
              confirmed ? 'bg-amber-300/40 scale-125' : 'bg-violet-200/30 scale-110',
            ].join(' ')} />
            {/* 鸽子圆 */}
            <div
              className={[
                'relative h-28 w-28 rounded-full flex items-center justify-center text-5xl',
                'transition-all duration-700',
                confirmed
                  ? 'bg-gradient-to-br from-amber-100 to-violet-100 shadow-lg shadow-amber-400/40 ring-4 ring-amber-300/50 ring-offset-2'
                  : 'bg-gradient-to-br from-violet-100/80 to-amber-50 shadow-md shadow-violet-300/30',
              ].join(' ')}
              style={{ animation: confirmed
                ? 'vigilDove 3s ease-in-out infinite'
                : 'vigilDoveSlow 6s ease-in-out infinite' }}
            >
              🕊️
            </div>
          </div>

          {/* 守望人数 */}
          <p className="text-6xl font-black leading-none"
            style={{ background: 'linear-gradient(160deg, #7c3aed 0%, #d4af37 100%)',
                     WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                     backgroundClip: 'text' }}>
            {watchingCount}
          </p>
          <p className="text-sm font-bold text-violet-700 mt-2">
            位肢体今日守望
          </p>
          <p className="text-xs text-violet-400 mt-0.5">
            共 {memberCount} 位同行者
          </p>
        </div>
      </div>

      {/* ── 守望按钮 ─────────────────────────────────── */}
      <div className="rounded-2xl border border-violet-100 bg-white/95 px-5 py-4 shadow-sm space-y-3">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 100))}
          placeholder="留一句默默的祷告（可选，不超过 100 字）…"
          rows={2}
          className="w-full rounded-xl border border-violet-100 bg-violet-50/40 px-4 py-2.5
                     text-sm text-stone-700 placeholder-violet-300
                     focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
        />
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        <button
          type="button"
          onClick={handlePresence}
          disabled={loading}
          className={[
            'w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all',
            confirmed
              ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'text-white shadow-md shadow-violet-500/30 hover:opacity-90 active:scale-[0.98]',
            'disabled:opacity-60',
          ].join(' ')}
          style={confirmed ? {} : {
            background: 'linear-gradient(135deg, #8b5cf6 0%, #d4af37 100%)',
          }}
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : confirmed
              ? '🕊️ 今日已守望（点击更新祷告）'
              : '🕊️ 今日守望'}
        </button>
        <p className="text-center text-[11px] text-violet-400 leading-relaxed">
          每日可更新一次守望记录<br />
          对方和其他肢体看不到你的名字，只看到人数
        </p>
      </div>

      {/* ── 今日守望者列表 ──────────────────────────── */}
      {presences.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-white/95 overflow-hidden shadow-sm">
          <p className="text-xs font-bold text-violet-500 uppercase tracking-wider px-5 pt-4 pb-2">
            今日守望肢体
          </p>
          <ul className="divide-y divide-violet-50">
            {presences.map(p => (
              <li key={p.user_id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-base shrink-0">
                  {p.user_id === myUserId ? '🕊️' : '🌿'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-700">
                    {p.user_id === myUserId ? `${p.display_name}（你）` : p.display_name}
                  </p>
                  {p.note && (
                    <p className="text-xs text-stone-400 mt-0.5 leading-relaxed truncate">{p.note}</p>
                  )}
                </div>
                <span className="text-[11px] text-amber-400 shrink-0 tabular-nums font-medium">
                  {p.created_at.slice(11, 16)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 鸽子动画关键帧 */}
      <style>{`
        @keyframes vigilDove {
          0%, 100% { transform: translateY(0px) scale(1) rotate(-2deg); }
          25%       { transform: translateY(-6px) scale(1.06) rotate(2deg); }
          75%       { transform: translateY(-3px) scale(1.03) rotate(-1deg); }
        }
        @keyframes vigilDoveSlow {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-4px) rotate(1deg); }
        }
      `}</style>
    </div>
  )
}
