'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { MemberCard } from './member-card'
import type { FellowshipPostsResponse } from '@/app/api/fellowship/posts/route'

interface FellowshipViewProps {
  data: FellowshipPostsResponse
}

export function FellowshipView({ data }: FellowshipViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [silentSent, setSilentSent]  = useState(false)
  const [silentError, setSilentError] = useState(false)

  const handleSilentEntry = useCallback(async () => {
    setSilentError(false)

    try {
      const res = await fetch('/api/fellowship/silent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fellowship_id: data.fellowship_id }),
      })

      if (!res.ok) throw new Error('silent_failed')

      setSilentSent(true)

      // Refresh server data to re-fetch with unlocked view
      startTransition(() => router.refresh())

    } catch {
      setSilentError(true)
    }
  }, [data.fellowship_id, router])

  return (
    <div className="flex flex-col gap-4">
      {/* ── Member cards ─────────────────────────── */}
      {data.posts.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.posts.map((post) => (
            <li key={post.alignment_id}>
              <MemberCard
                post={post}
                isUnlocked={data.is_unlocked}
                fellowshipId={data.fellowship_id}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ── Silent entry button (only when locked) ──
           Shown below the blurred cards as a warm invitation.
           Disappears once the user has submitted/entered silently. */}
      {!data.is_unlocked && !silentSent && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <div className="h-px w-full bg-border" />
          <button
            type="button"
            onClick={handleSilentEntry}
            disabled={isPending}
            className={`
              mt-2 rounded-xl border border-border bg-card px-5 py-3
              text-sm text-muted-foreground transition-colors
              hover:border-gold-300 hover:text-gold-700 hover:bg-gold-400/5
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              disabled:cursor-not-allowed disabled:opacity-60
            `}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                稍等…
              </span>
            ) : (
              '虽无言，但在暗中陪你'
            )}
          </button>

          {silentError && (
            <p className="text-xs text-destructive">网络异常，请稍后再试</p>
          )}

          <p className="text-center text-xs text-muted-foreground/60 max-w-[240px]">
            点击后以静默方式同行，你的存在本身就是祝福
          </p>
        </div>
      )}

      {/* ── Post-silent confirmation ──────────────── */}
      {silentSent && (
        <p className="mt-2 text-center text-sm text-muted-foreground animate-in fade-in">
          {isPending ? '页面正在刷新…' : '✓ 已静默同行，你的存在本身就是祝福'}
        </p>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="text-3xl">🌾</span>
      <p className="text-sm font-medium text-foreground">今日还没有人分享</p>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        完成今日内室后，团契便会亮起微光。
      </p>
    </div>
  )
}
