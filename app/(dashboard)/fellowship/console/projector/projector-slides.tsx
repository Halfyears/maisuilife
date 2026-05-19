'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// Floating exit button — returns to the specific fellowship's console page
function ExitButton({ fellowshipId }: { fellowshipId: string }) {
  return (
    <a
      href={`/fellowship/console?id=${fellowshipId}`}
      className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-xl
                 bg-black/20 px-3 py-1.5 text-xs text-white/50
                 hover:bg-black/40 hover:text-white/90 transition-all backdrop-blur-sm"
    >
      <X className="h-3.5 w-3.5" />
      退出投屏
    </a>
  )
}

interface ScriptureCard {
  verse: string
  ref:   string
}

interface SessionData {
  id:              string
  state:           'checkin' | 'harvest'
  expected_count:  number
  checkin_count:   number
  wheat_total:     number
  amen_count:      number
  progress:        number
  scripture_cards: ScriptureCard[] | null
}

interface Checkin {
  anon_label:    string
  checked_in_at: string
}

interface Props {
  fellowshipId:  string
  fellowshipName: string
  todayZh:        string
  theme:          string | null
  scriptureRef:   string | null
  scriptureText:  string | null
  moodEntries:    [string, number][]
  total:          number
}

export function ProjectorSlides({
  fellowshipId, fellowshipName, todayZh, theme, scriptureRef, scriptureText, moodEntries, total,
}: Props) {
  const [session, setSession]   = useState<SessionData | null>(null)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [idx, setIdx]           = useState(0)

  const poll = useCallback(async () => {
    const res = await fetch(`/api/fellowship/session/current?fellowship_id=${fellowshipId}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setSession(data.session ?? null)
    setCheckins(data.checkins ?? [])
  }, [fellowshipId])

  // Initial load
  useEffect(() => { poll() }, [poll])

  // Poll every 2s when a session is active
  useEffect(() => {
    if (!session) return
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [session, poll])

  // If no active session: show regular slides
  if (!session) {
    return (<>
      <ExitButton fellowshipId={fellowshipId} />
      <StaticSlides
        fellowshipName={fellowshipName}
        todayZh={todayZh}
        theme={theme}
        scriptureRef={scriptureRef}
        scriptureText={scriptureText}
        moodEntries={moodEntries}
        total={total}
        idx={idx}
        setIdx={setIdx}
      />
    </>)
  }

  if (session.state === 'checkin') {
    return (<>
      <ExitButton fellowshipId={fellowshipId} />
      <CheckinSlide
        session={session}
        checkins={checkins}
        fellowshipName={fellowshipName}
        todayZh={todayZh}
      />
    </>)
  }

  // harvest state
  return (<>
    <ExitButton fellowshipId={fellowshipId} />
    <HarvestSlide
      session={session}
      fellowshipId={fellowshipId}
      fellowshipName={fellowshipName}
    />
  </>)
}

// ── Static slides (no active session) ────────────────────────────────────────
function StaticSlides({
  fellowshipName, todayZh, theme, scriptureRef, scriptureText, moodEntries, total, idx, setIdx,
}: Omit<Props, 'fellowshipId'> & { idx: number; setIdx: (fn: (i: number) => number) => void }) {
  const slides: ('theme' | 'mood')[] = []
  if (theme || scriptureText) slides.push('theme')
  slides.push('mood')

  const current  = slides[idx] ?? 'mood'
  const canPrev  = idx > 0
  const canNext  = idx < slides.length - 1

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#F4F1EA' }}
      onClick={() => canNext && setIdx(i => i + 1)}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        {slides.length > 1 && (
          <span className="text-xs text-stone-400 tabular-nums">{idx + 1} / {slides.length}</span>
        )}
        {canPrev && (
          <button type="button" onClick={e => { e.stopPropagation(); setIdx(i => i - 1) }}
            className="rounded-full bg-stone-200/60 p-2 hover:bg-stone-300/60 transition-colors">
            <ChevronLeft className="h-5 w-5 text-stone-500" />
          </button>
        )}
        {canNext && (
          <button type="button" onClick={e => { e.stopPropagation(); setIdx(i => i + 1) }}
            className="rounded-full bg-stone-200/60 p-2 hover:bg-stone-300/60 transition-colors">
            <ChevronRight className="h-5 w-5 text-stone-500" />
          </button>
        )}
      </div>

      {current === 'theme' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-10 px-12 text-center">
          <div>
            <p className="text-base font-medium tracking-widest text-stone-400 uppercase">{fellowshipName}</p>
            <p className="mt-1 text-sm text-stone-400">{todayZh}</p>
          </div>
          {theme && (
            <h1 className="font-serif text-5xl font-bold text-stone-800 leading-tight max-w-xl">{theme}</h1>
          )}
          {scriptureText && (
            <div className="max-w-2xl space-y-3">
              <p className="font-serif text-2xl text-stone-700 leading-relaxed whitespace-pre-line italic">
                "{scriptureText}"
              </p>
              {scriptureRef && (
                <p className="text-base text-stone-400 tracking-wide">— {scriptureRef}</p>
              )}
            </div>
          )}
        </div>
      )}

      {current === 'mood' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-12 px-8">
          <div className="text-center">
            <p className="text-base font-medium tracking-widest text-stone-400 uppercase">{fellowshipName}</p>
            <p className="mt-1 text-sm text-stone-400">{todayZh}</p>
          </div>
          {moodEntries.length === 0 ? (
            <p className="text-4xl font-light text-stone-400">今日尚无分享</p>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {moodEntries.map(([tag, count]) => (
                <div key={tag} className="flex items-baseline gap-4">
                  <span className="font-serif font-bold text-stone-700"
                    style={{ fontSize: `${Math.max(3, 2 + count)}rem`, lineHeight: 1.1 }}>
                    {tag}
                  </span>
                  <span className="text-2xl font-light text-stone-400 tabular-nums">{count} 人</span>
                </div>
              ))}
            </div>
          )}
          {total > 0 && <p className="text-lg text-stone-400">共 {total} 位同行者</p>}
        </div>
      )}

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-widest text-stone-300">
        麦穗喜乐 · 微光同行
      </p>
    </div>
  )
}

// ── Checkin slide: candle matrix ──────────────────────────────────────────────
function CheckinSlide({
  session, checkins, fellowshipName, todayZh,
}: {
  session:        SessionData
  checkins:       Checkin[]
  fellowshipName: string
  todayZh:        string
}) {
  // Build N-cell candle matrix: lit = checked in, unlit = waiting
  const total = session.expected_count
  const lit   = session.checkin_count

  // Lock progress bar at 85% when all but one have checked in
  const barWidth = session.progress

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-8"
      style={{ backgroundColor: '#1a1009' }}
    >
      <div className="text-center">
        <p className="text-sm font-medium tracking-widest text-amber-400/60 uppercase">{fellowshipName}</p>
        <p className="mt-1 text-xs text-amber-400/40">{todayZh}</p>
      </div>

      {/* Candle grid */}
      <div className="flex flex-wrap justify-center gap-4 max-w-2xl">
        {Array.from({ length: total }).map((_, i) => {
          const isLit = i < lit
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`text-4xl transition-all duration-500 ${isLit ? 'opacity-100' : 'opacity-20'}`}
                style={{ filter: isLit ? 'drop-shadow(0 0 12px #f59e0b)' : 'none' }}>
                🕯️
              </div>
              {isLit && checkins[i] && (
                <p className="text-[10px] text-amber-400/60 text-center max-w-[60px] truncate">
                  {checkins[i].anon_label}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              barWidth >= 100
                ? 'bg-gradient-to-r from-yellow-400 to-amber-400'
                : 'bg-gradient-to-r from-amber-600 to-orange-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p className="text-center text-sm text-amber-400/70 tabular-nums">
          {lit} / {total} 位同行者已点亮
          {barWidth >= 100 && (
            <span className="ml-2 text-yellow-400 font-bold">🎉 全员到齐！</span>
          )}
        </p>
      </div>

      <p className="text-xs tracking-widest text-amber-400/20">麦穗喜乐 · 微光同行</p>
    </div>
  )
}

// ── Harvest slide: wheat explosion + scripture cards + amen counter ───────────
function HarvestSlide({
  session, fellowshipId, fellowshipName,
}: {
  session:        SessionData
  fellowshipId:   string
  fellowshipName: string
}) {
  const [amen, setAmen]       = useState(session.amen_count)
  const [burst, setBurst]     = useState(false)
  const [cardIdx, setCardIdx] = useState(0)

  const cards = session.scripture_cards ?? []

  // Poll for amen count from other devices
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/fellowship/session/current?fellowship_id=${fellowshipId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.session?.amen_count !== undefined) setAmen(data.session.amen_count)
    }, 3000)
    return () => clearInterval(id)
  }, [fellowshipId])

  async function handleAmen() {
    setBurst(true)
    setTimeout(() => setBurst(false), 600)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40)
    const newCount = amen + 1
    setAmen(newCount)
    await fetch('/api/fellowship/session/amen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-8"
      style={{ backgroundColor: '#0d0a04' }}
    >
      <div className="text-center">
        <p className="text-sm font-medium tracking-widest text-amber-400/50 uppercase">{fellowshipName}</p>
        <p className="mt-1 text-xs text-amber-400/30">今日丰收</p>
      </div>

      {/* Big wheat number */}
      <div className={`text-center transition-transform duration-300 ${burst ? 'scale-125' : 'scale-100'}`}>
        <p className="text-9xl font-black text-amber-400 tabular-nums"
          style={{ textShadow: '0 0 60px rgba(245,158,11,0.6)' }}>
          {session.wheat_total}
        </p>
        <p className="text-2xl text-amber-400/60 mt-1">粒麦穗</p>
      </div>

      {/* Scripture card carousel */}
      {cards.length > 0 && (
        <div
          className="w-full max-w-xl cursor-pointer text-center space-y-3"
          onClick={() => setCardIdx(i => (i + 1) % cards.length)}
        >
          <p className="font-serif text-xl text-amber-100/80 italic leading-relaxed">
            "{cards[cardIdx].verse}"
          </p>
          <p className="text-sm text-amber-400/50">—— {cards[cardIdx].ref}</p>
          {cards.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {cards.map((_, i) => (
                <div key={i} className={`h-1 w-6 rounded-full transition-all ${i === cardIdx ? 'bg-amber-400' : 'bg-stone-700'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Amen button */}
      <button
        onClick={handleAmen}
        className={`relative flex flex-col items-center gap-2 rounded-2xl
                   border-2 border-amber-500/40 bg-amber-500/10 px-12 py-5
                   text-amber-400 hover:bg-amber-500/20 active:scale-95
                   transition-all duration-200 ${burst ? 'border-amber-400 bg-amber-500/30' : ''}`}
      >
        <span className="text-3xl">🙏</span>
        <span className="text-lg font-bold tracking-widest">阿们！</span>
        <span className="text-xs text-amber-400/50 tabular-nums">{amen} 声</span>
      </button>

      <p className="text-xs tracking-widest text-amber-400/20">麦穗喜乐 · 微光同行</p>
    </div>
  )
}
