'use client'

import { useState, useTransition } from 'react'
import { Wifi, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type MeetingMode = 'in-person' | 'online'

interface SpatialToggleProps {
  fellowshipId:  string
  initialMode:   MeetingMode
  ytLink?:       string | null
}

export function SpatialToggle({ fellowshipId, initialMode, ytLink: initialYtLink }: SpatialToggleProps) {
  const [mode, setMode]         = useState<MeetingMode>(initialMode)
  const [ytLink, setYtLink]     = useState(initialYtLink ?? '')
  const [isPending, startTrans] = useTransition()
  const [saved, setSaved]       = useState(false)

  const handleModeToggle = async (next: MeetingMode) => {
    setMode(next)
    startTrans(async () => {
      await fetch('/api/fellowship/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fellowship_id: fellowshipId, meeting_mode: next }),
      })
    })
  }

  const handleYtSave = async () => {
    startTrans(async () => {
      const res = await fetch('/api/fellowship/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fellowship_id: fellowshipId,
          yt_link: ytLink.trim() || null,
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">空间切换</h2>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
        {(['in-person', 'online'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeToggle(m)}
            disabled={isPending}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm transition-all',
              mode === m
                ? 'bg-gold-400/15 text-gold-700 font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'in-person'
              ? <><Users className="h-4 w-4" /> 实体聚会</>
              : <><Wifi  className="h-4 w-4" /> 线上聚会</>
            }
          </button>
        ))}
      </div>

      {/* YouTube link (only relevant for online mode, but always available) */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="yt-link">
          本周 YouTube 链接
        </label>
        <div className="flex gap-2">
          <input
            id="yt-link"
            type="url"
            value={ytLink}
            onChange={(e) => setYtLink(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={cn(
              'flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm',
              'placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          />
          <button
            type="button"
            onClick={handleYtSave}
            disabled={isPending}
            className={cn(
              'rounded-lg border border-border px-4 py-2 text-sm transition-colors',
              'hover:border-gold-300 hover:text-gold-700 hover:bg-gold-400/8',
              saved && 'border-sage-300 text-sage-700 bg-sage-100',
            )}
          >
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>
    </section>
  )
}
