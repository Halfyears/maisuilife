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
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-blue-50/70 px-5 py-6 text-center">
        {/* 和平鸽 */}
        <div
          className={[
            'mx-auto h-16 w-16 rounded-full flex items-center justify-center text-3xl mb-4 transition-all duration-700',
            confirmed
              ? 'bg-gradient-to-br from-sky-200 to-blue-200 shadow-md shadow-sky-300/40 ring-2 ring-sky-300'
              : 'bg-sky-100/80',
          ].join(' ')}
          style={confirmed
            ? { animation: 'vigilDove 3s ease-in-out infinite' }
            : { animation: 'vigilDoveSlow 5s ease-in-out infinite' }}
        >
          🕊️
        </div>
        <p className="text-5xl font-black leading-none bg-gradient-to-b from-sky-600 to-blue-700 bg-clip-text text-transparent">
          {watchingCount}
        </p>
        <p className="text-sm text-sky-600 mt-2 font-semibold">
          位肢体今日守望
        </p>
        <p className="text-xs text-sky-400 mt-0.5">
          共 {memberCount} 位同行者
        </p>
      </div>

      {/* ── 守望按钮 ─────────────────────────────────── */}
      <div className="rounded-2xl border border-sky-100 bg-white/90 px-5 py-4 shadow-sm space-y-3">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 100))}
          placeholder="留一句默默的祷告（可选，不超过 100 字）…"
          rows={2}
          className="w-full rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-2.5
                     text-sm text-stone-700 placeholder-sky-300
                     focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
        />
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        <button
          type="button"
          onClick={handlePresence}
          disabled={loading}
          className={[
            'w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all',
            confirmed
              ? 'border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100'
              : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-md shadow-sky-500/25',
            'disabled:opacity-60',
          ].join(' ')}
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : confirmed
              ? '🕊️ 今日已守望（点击更新祷告）'
              : '🕊️ 今日守望'}
        </button>
        <p className="text-center text-[11px] text-sky-400 leading-relaxed">
          每日可更新一次守望记录<br />
          对方和其他肢体看不到你的名字，只看到人数
        </p>
      </div>

      {/* ── 今日守望者列表 ──────────────────────────── */}
      {presences.length > 0 && (
        <div className="rounded-2xl border border-sky-100 bg-white/90 overflow-hidden shadow-sm">
          <p className="text-xs font-semibold text-sky-500 uppercase tracking-wider px-5 pt-4 pb-2">
            今日守望肢体
          </p>
          <ul className="divide-y divide-sky-50">
            {presences.map(p => (
              <li key={p.user_id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-sm shrink-0">
                  {p.user_id === myUserId ? '🕊️' : '🌿'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700">
                    {p.user_id === myUserId ? `${p.display_name}（你）` : p.display_name}
                  </p>
                  {p.note && (
                    <p className="text-xs text-stone-400 mt-0.5 leading-relaxed truncate">{p.note}</p>
                  )}
                </div>
                <span className="text-[11px] text-sky-300 shrink-0 tabular-nums">
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
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-4px) scale(1.05); }
        }
        @keyframes vigilDoveSlow {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}
