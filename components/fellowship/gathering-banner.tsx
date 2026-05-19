'use client'

import { useState, useEffect, useCallback } from 'react'

interface SessionData {
  id:              string
  state:           'checkin' | 'harvest'
  expected_count:  number
  checkin_count:   number
  wheat_total:     number
  amen_count:      number
  progress:        number
  scripture_cards: { verse: string; ref: string }[] | null
}

interface Props {
  fellowshipId: string
}

export function GatheringBanner({ fellowshipId }: Props) {
  const [session, setSession]         = useState<SessionData | null>(null)
  const [iCheckedIn, setICheckedIn]   = useState(false)
  const [checking, setChecking]       = useState(false)
  const [amenCount, setAmenCount]     = useState(0)
  const [amenBurst, setAmenBurst]     = useState(false)
  const [cardIdx, setCardIdx]         = useState(0)

  const poll = useCallback(async () => {
    const res = await fetch(`/api/fellowship/session/current?fellowship_id=${fellowshipId}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setSession(data.session ?? null)
    setICheckedIn(data.i_checked_in ?? false)
    if (data.session?.amen_count !== undefined) setAmenCount(data.session.amen_count)
  }, [fellowshipId])

  useEffect(() => { poll() }, [poll])

  useEffect(() => {
    if (!session) return
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [session, poll])

  async function doCheckin() {
    if (iCheckedIn || checking) return
    setChecking(true)
    const res = await fetch('/api/fellowship/session/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fellowship_id: fellowshipId }),
    })
    if (res.ok) setICheckedIn(true)
    await poll()
    setChecking(false)
  }

  async function doAmen() {
    if (!session) return
    if ('vibrate' in navigator) navigator.vibrate(50)
    setAmenBurst(true)
    setTimeout(() => setAmenBurst(false), 400)
    setAmenCount(n => n + 1)
    await fetch('/api/fellowship/session/amen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })
  }

  // Nothing to show if no active session
  if (!session) return null

  // ── Checkin state ─────────────────────────────────────────────────────────
  if (session.state === 'checkin') {
    return (
      <div className="mb-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-4 shadow-md shadow-amber-900/5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🕯️</span>
          <p className="text-sm font-bold text-stone-900">聚会签到开始了</p>
          <span className="ml-auto text-xs text-stone-400 tabular-nums">
            {session.checkin_count} / {session.expected_count}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 mb-3">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              session.progress >= 100
                ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                : 'bg-gradient-to-r from-amber-400 to-orange-400'
            }`}
            style={{ width: `${Math.min(session.progress, 100)}%` }}
          />
        </div>

        {iCheckedIn ? (
          /* Digital fast overlay after check-in */
          <div className="rounded-xl bg-amber-100/60 border border-amber-200 px-4 py-3 text-center">
            <p className="text-sm font-medium text-amber-700">✓ 你已签到 · 静默等候祂</p>
            <p className="text-xs text-amber-600/70 mt-1 italic">
              "在静默中得力" — 以赛亚书 30:15
            </p>
          </div>
        ) : (
          <button
            onClick={doCheckin}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 rounded-xl
                       bg-gradient-to-r from-amber-500 to-orange-500
                       px-4 py-3 text-sm font-bold text-white
                       shadow-sm shadow-orange-500/20 hover:opacity-90
                       disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {checking ? '签到中…' : '🕯️ 点亮我的烛光'}
          </button>
        )}
      </div>
    )
  }

  // ── Harvest state ─────────────────────────────────────────────────────────
  const cards = session.scripture_cards ?? []

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/60 px-5 py-5 shadow-md shadow-amber-900/5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🌾</span>
        <p className="text-sm font-bold text-stone-900">丰收时刻</p>
        <span className="ml-auto text-2xl font-black text-amber-600 tabular-nums">{session.wheat_total}</span>
        <span className="text-xs text-amber-400">粒</span>
      </div>

      {/* Scripture card carousel */}
      {cards.length > 0 && (
        <div
          className="mb-4 cursor-pointer rounded-xl border border-amber-100 bg-white/70 px-4 py-3 text-center"
          onClick={() => setCardIdx(i => (i + 1) % cards.length)}
        >
          <p className="text-sm text-stone-700 italic leading-relaxed">
            "{cards[cardIdx].verse}"
          </p>
          <p className="mt-1.5 text-xs text-stone-400">—— {cards[cardIdx].ref}</p>
          {cards.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {cards.map((_, i) => (
                <div key={i} className={`h-1 w-4 rounded-full transition-all ${i === cardIdx ? 'bg-amber-400' : 'bg-stone-200'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Amen button */}
      <button
        onClick={doAmen}
        className={`w-full flex items-center justify-center gap-2 rounded-xl
                   border-2 px-4 py-3.5 text-sm font-bold transition-all active:scale-[0.97]
                   ${amenBurst
                     ? 'border-amber-400 bg-amber-100 text-amber-700 scale-105'
                     : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                   }`}
      >
        <span className="text-lg">🙏</span>
        阿们！
        <span className="ml-1 text-xs font-normal text-amber-400 tabular-nums">{amenCount} 声</span>
      </button>
    </div>
  )
}
