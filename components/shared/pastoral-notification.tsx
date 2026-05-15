'use client'

import { useState, useCallback } from 'react'
import { Heart, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PastoralNotificationProps {
  requestId:   string
  leaderName?: string
}

/**
 * Level 3 授权弹窗 — 成员视角。
 *
 * 显示场景：pastoral_requests 中存在 status='PENDING' 且 member_id=当前用户 的记录。
 * 成员点击 [允许] → POST /api/pastoral/approve { decision: 'approve' }
 *   → 组长后台的 member_name 随即解锁
 * 成员点击 [婉拒] → decision: 'deny'
 *   → 人名永久锁定
 */
export function PastoralNotification({ requestId, leaderName }: PastoralNotificationProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [decision, setDecision] = useState<'approve' | 'deny' | null>(null)

  const respond = useCallback(async (d: 'approve' | 'deny') => {
    setState('loading')
    setDecision(d)
    try {
      await fetch('/api/pastoral/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ request_id: requestId, decision: d }),
      })
      setState('done')
    } catch {
      setState('idle')
    }
  }, [requestId])

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-border bg-card px-5 py-4 text-center">
        <p className="text-sm text-muted-foreground">
          {decision === 'approve'
            ? '感谢你的信任，组长将与你同行。'
            : '已婉拒，你的隐私受到保护。'}
        </p>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-2xl border border-gold-200 bg-gold-400/6 px-5 py-4',
      'animate-in fade-in slide-in-from-top-2 duration-400',
    )}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 shrink-0 text-gold-600" />
          <p className="text-sm font-medium text-foreground">
            {leaderName ? `${leaderName}` : '你的组长'} 想关怀你
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        你在祷告中标记了代祷需求。组长希望与你分担，
        请选择是否允许对方知道你的身份并与你联系。
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond('approve')}
          disabled={state === 'loading'}
          className={cn(
            'flex-1 rounded-xl bg-gold-400 py-2.5 text-sm font-medium text-gold-900',
            'hover:bg-gold-500 transition-colors disabled:opacity-60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          允许
        </button>
        <button
          type="button"
          onClick={() => respond('deny')}
          disabled={state === 'loading'}
          className={cn(
            'flex-1 rounded-xl border border-border bg-card py-2.5 text-sm text-muted-foreground',
            'hover:bg-muted transition-colors disabled:opacity-60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          婉拒
        </button>
      </div>
    </div>
  )
}
