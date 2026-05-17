'use client'

import { useState, useCallback } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_TAGS } from '@/lib/constants'
import type { FellowshipPost } from '@/app/api/fellowship/posts/route'

interface MemberCardProps {
  post: FellowshipPost
  isUnlocked: boolean
  fellowshipId: string
}

export function MemberCard({ post, isUnlocked, fellowshipId }: MemberCardProps) {
  const [nian, setNian]     = useState(post.react_nian)
  const [amen, setAmen]     = useState(post.react_amen)
  const [pulsing, setPulsing] = useState<'nian' | 'amen' | null>(null)

  const statusMeta = STATUS_TAGS.find((t) => t.value === post.status_tag)

  const handleReact = useCallback(async (reaction: 'nian' | 'amen') => {
    // Optimistic update
    if (reaction === 'nian') setNian((n) => n + 1)
    else                     setAmen((n) => n + 1)

    // Pulse animation
    setPulsing(reaction)
    setTimeout(() => setPulsing(null), 600)

    // Fire and forget — no identity stored server-side
    fetch('/api/fellowship/react', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ alignment_id: post.alignment_id, reaction }),
    }).catch(() => {
      // Rollback on network failure
      if (reaction === 'nian') setNian((n) => Math.max(0, n - 1))
      else                     setAmen((n) => Math.max(0, n - 1))
    })
  }, [post.alignment_id])

  const summaryVisible = isUnlocked && post.summary && !post.is_silent

  return (
    <article className={cn(
      'rounded-2xl border bg-card px-4 py-4 transition-shadow',
      post.is_self
        ? 'border-gold-300 bg-gold-400/5 shadow-sm'
        : 'border-border',
    )}>
      {/* ── Header row ──────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Status emoji */}
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-oat-200 text-base"
          aria-label={post.status_tag}
        >
          {statusMeta?.emoji ?? '🌿'}
        </span>

        {/* Layer-2 pseudonym */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {post.layer2_label || '同行者'}
            {post.is_self && (
              <span className="ml-1.5 text-xs text-gold-600">(你)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {post.is_silent ? '静默同行' : post.status_tag}
          </p>
        </div>

        {/* Lock badge — only show when content is gated */}
        {!isUnlocked && !post.is_self && (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
        )}
      </div>

      {/* ── Summary content ──────────────────────── */}
      {!post.is_silent && (
        <div className="relative mt-3 overflow-hidden rounded-lg bg-muted/50 px-3 py-2.5">
          {/* Placeholder text always rendered (for consistent height) */}
          <p className={cn(
            'text-sm leading-relaxed text-foreground/80',
            !summaryVisible && 'text-transparent select-none',
          )}>
            {summaryVisible
              ? post.summary
              : '心声正在等待被看见，先把自己的心放下吧。'
            }
          </p>

          {/* Blur overlay + lock icon */}
          {!summaryVisible && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg backdrop-blur-md">
              <Lock className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground/60">完成今日祷告后可见</span>
            </div>
          )}
        </div>
      )}

      {/* ── Reaction buttons ─────────────────────── */}
      <div className="mt-3 flex items-center gap-3">
        <ReactionButton
          label="🙏 记念"
          count={nian}
          active={pulsing === 'nian'}
          onClick={() => handleReact('nian')}
        />
        <ReactionButton
          label="Amen"
          count={amen}
          active={pulsing === 'amen'}
          onClick={() => handleReact('amen')}
        />
      </div>
    </article>
  )
}

// ── Pulse reaction button ─────────────────────────────────
interface ReactionButtonProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function ReactionButton({ label, count, active, onClick }: ReactionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} ${count}`}
      className={cn(
        'relative flex items-center gap-1.5 rounded-full border px-3 py-1',
        'text-xs text-muted-foreground transition-all duration-150',
        'hover:border-gold-300 hover:text-gold-700 hover:bg-gold-400/8',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'active:scale-95',
        // Pulse glow on click
        active && 'border-gold-300 text-gold-700 bg-gold-400/10',
      )}
    >
      {/* Pulse ring — animates for 600ms then removed */}
      {active && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping bg-gold-400/25"
          style={{ animationDuration: '0.6s', animationIterationCount: 1 }}
        />
      )}
      <span className="relative">{label}</span>
      {count > 0 && (
        <span className="relative tabular-nums">{count}</span>
      )}
    </button>
  )
}
