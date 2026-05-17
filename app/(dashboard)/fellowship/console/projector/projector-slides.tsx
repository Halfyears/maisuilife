'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  fellowshipName: string
  todayZh:        string
  theme:          string | null
  scriptureRef:   string | null
  scriptureText:  string | null
  moodEntries:    [string, number][]
  total:          number
}

export function ProjectorSlides({
  fellowshipName, todayZh, theme, scriptureRef, scriptureText, moodEntries, total,
}: Props) {
  // Build slide list
  const slides: ('theme' | 'mood')[] = []
  if (theme || scriptureText) slides.push('theme')
  slides.push('mood')

  const [idx, setIdx] = useState(0)
  const current = slides[idx] ?? 'mood'
  const canPrev = idx > 0
  const canNext = idx < slides.length - 1

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#F4F1EA' }}
      onClick={() => canNext && setIdx(i => i + 1)}
    >
      {/* Nav hint */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        {slides.length > 1 && (
          <span className="text-xs text-stone-400 tabular-nums">
            {idx + 1} / {slides.length}
          </span>
        )}
        {canPrev && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIdx(i => i - 1) }}
            className="rounded-full bg-stone-200/60 p-2 hover:bg-stone-300/60 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-stone-500" />
          </button>
        )}
        {canNext && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIdx(i => i + 1) }}
            className="rounded-full bg-stone-200/60 p-2 hover:bg-stone-300/60 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-stone-500" />
          </button>
        )}
      </div>

      {current === 'theme' && (
        <ThemeSlide
          fellowshipName={fellowshipName}
          todayZh={todayZh}
          theme={theme}
          scriptureRef={scriptureRef}
          scriptureText={scriptureText}
        />
      )}

      {current === 'mood' && (
        <MoodSlide
          fellowshipName={fellowshipName}
          todayZh={todayZh}
          entries={moodEntries}
          total={total}
        />
      )}

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-widest text-stone-300">
        麦穗喜乐 · 微光同行
      </p>
    </div>
  )
}

// ── 主题 + 经文幻灯 ──────────────────────────────────────────────────
function ThemeSlide({
  fellowshipName, todayZh, theme, scriptureRef, scriptureText,
}: {
  fellowshipName: string
  todayZh:        string
  theme:          string | null
  scriptureRef:   string | null
  scriptureText:  string | null
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 px-12 text-center">
      <div>
        <p className="text-base font-medium tracking-widest text-stone-400 uppercase">
          {fellowshipName}
        </p>
        <p className="mt-1 text-sm text-stone-400">{todayZh}</p>
      </div>

      {theme && (
        <h1 className="font-serif text-5xl font-bold text-stone-800 leading-tight max-w-xl">
          {theme}
        </h1>
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
  )
}

// ── 情绪词云幻灯 ──────────────────────────────────────────────────────
function MoodSlide({
  fellowshipName, todayZh, entries, total,
}: {
  fellowshipName: string
  todayZh:        string
  entries:        [string, number][]
  total:          number
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-12 px-8">
      <div className="text-center">
        <p className="text-base font-medium tracking-widest text-stone-400 uppercase">
          {fellowshipName}
        </p>
        <p className="mt-1 text-sm text-stone-400">{todayZh}</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-4xl font-light text-stone-400">今日尚无分享</p>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {entries.map(([tag, count]) => (
            <div key={tag} className="flex items-baseline gap-4">
              <span
                className="font-serif font-bold text-stone-700"
                style={{ fontSize: `${Math.max(3, 2 + count)}rem`, lineHeight: 1.1 }}
              >
                {tag}
              </span>
              <span className="text-2xl font-light text-stone-400 tabular-nums">
                {count} 人
              </span>
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <p className="text-lg text-stone-400">共 {total} 位同行者</p>
      )}
    </div>
  )
}
