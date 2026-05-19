'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flame, Wheat, X, Users, ChevronRight } from 'lucide-react'

interface SessionState {
  id: string
  state: 'checkin' | 'harvest'
  expected_count: number
  checkin_count: number
  wheat_total: number
  amen_count: number
  progress: number
  scripture_cards: { verse: string; ref: string }[] | null
}

interface Props {
  fellowshipId: string
}

export function SessionPanel({ fellowshipId }: Props) {
  const [session, setSession] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [startErr, setStartErr] = useState<string | null>(null)
  const [expectedInput, setExpectedInput] = useState('')

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/fellowship/session/current?fellowship_id=${fellowshipId}`, { cache: 'no-store' })
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setSession(data.session)
    setLoading(false)
  }, [fellowshipId])

  // Initial load + poll every 3s when checkin is active
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (session?.state !== 'checkin') return
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [session?.state, refresh])

  async function startSession() {
    const n = parseInt(expectedInput, 10)
    if (!n || n < 1) return
    setBusy(true)
    setStartErr(null)
    const res = await fetch('/api/fellowship/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fellowship_id: fellowshipId, expected_count: n }),
    })
    if (!res.ok) {
      setStartErr('开启签到失败，请重试')
      setBusy(false)
      return
    }
    await refresh()
    setBusy(false)
  }

  async function triggerHarvest() {
    if (!session) return
    setBusy(true)
    await fetch('/api/fellowship/session/harvest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })
    await refresh()
    setBusy(false)
  }

  async function closeSession() {
    if (!session) return
    setBusy(true)
    // close = update state to 'closed' via the start route re-use pattern
    // We repurpose: just start a new session which closes the old one, then...
    // Actually: we need a close endpoint. Let me call it via a direct supabase-free approach.
    // For now: POST to /api/fellowship/session/start with expected_count=1 to close then immediately
    // No — let's just do a simple PATCH approach. We'll update via the same admin pattern.
    // Use a dedicated endpoint: for simplicity, re-use start which closes open sessions first.
    // But that would create a new one. Instead: use a state param.
    // Best: call close endpoint (we'll handle it gracefully even without it).
    await fetch('/api/fellowship/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })
    await refresh()
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4">
        <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/60 to-orange-50/40 px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
          <Flame className="h-4 w-4 text-amber-600" />
        </div>
        <h3 className="text-sm font-bold text-stone-900">聚会签到</h3>
        {session && (
          <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${
            session.state === 'checkin'  ? 'bg-amber-100 text-amber-700' :
            session.state === 'harvest' ? 'bg-green-100 text-green-700'  : ''
          }`}>
            {session.state === 'checkin' ? '签到中' : '收割中'}
          </span>
        )}
      </div>

      {/* ── No active session ── */}
      {!session && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">开始聚会前，输入今日到场人数并开启签到。</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={expectedInput}
              onChange={e => setExpectedInput(e.target.value)}
              placeholder="今日人数"
              className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900
                         placeholder:text-stone-300 focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={startSession}
              disabled={busy || !expectedInput}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl
                         bg-amber-500 px-4 py-2 text-sm font-bold text-white
                         hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
              开启签到
            </button>
          </div>
          {startErr && <p className="text-xs text-red-500 px-1">{startErr}</p>}
        </div>
      )}

      {/* ── Checkin state ── */}
      {session?.state === 'checkin' && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-stone-500">已签到</p>
              <p className="text-3xl font-black text-stone-900">
                {session.checkin_count}
                <span className="text-lg font-medium text-stone-400"> / {session.expected_count}</span>
              </p>
            </div>
            <Users className="h-8 w-8 text-amber-200" />
          </div>

          {/* Progress bar — locked at 85% until full */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                session.progress >= 100
                  ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                  : 'bg-gradient-to-r from-amber-400 to-orange-400'
              }`}
              style={{ width: `${Math.min(session.progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 text-center">
            {session.progress < 85
              ? `等待 ${session.expected_count - session.checkin_count} 人签到`
              : session.progress < 100
              ? '🔥 还差最后一人！'
              : '🎉 全员到齐！'}
          </p>

          <button
            onClick={triggerHarvest}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl
                       bg-gradient-to-r from-amber-500 to-orange-500
                       px-4 py-3 text-sm font-bold text-white
                       shadow-md shadow-orange-500/20 hover:opacity-90
                       disabled:opacity-50 transition-all"
          >
            <Wheat className="h-4 w-4" />
            开启丰收收割
          </button>
        </div>
      )}

      {/* ── Harvest state ── */}
      {session?.state === 'harvest' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-500">今日麦穗丰收</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-amber-600">{session.wheat_total}</p>
                <span className="text-lg text-amber-400">🌾</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-400">阿门</p>
              <p className="text-2xl font-black text-stone-700">{session.amen_count}</p>
            </div>
          </div>

          {session.scripture_cards && session.scripture_cards.length > 0 && (
            <div className="space-y-2">
              {session.scripture_cards.map((card, i) => (
                <div key={i} className="rounded-xl bg-white/70 border border-amber-100 px-3 py-2.5">
                  <p className="text-xs text-stone-700 italic leading-relaxed">"{card.verse}"</p>
                  <p className="mt-1 text-[10px] text-stone-400">—— {card.ref}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={closeSession}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl
                       border border-stone-200 bg-white px-4 py-2.5 text-xs font-medium text-stone-500
                       hover:border-red-200 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            结束本次聚会
          </button>
        </div>
      )}
    </div>
  )
}
