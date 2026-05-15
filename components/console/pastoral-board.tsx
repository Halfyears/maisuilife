'use client'

import { useState, useCallback } from 'react'
import { Bell, UserCheck, UserX, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnonymousFlag, PastoralCard } from '@/app/api/pastoral/list/route'

interface PastoralBoardProps {
  pendingFlags: AnonymousFlag[]
  requests:     PastoralCard[]
  fellowshipId: string
}

// ════════════════════════════════════════════════════════
//  PastoralBoard
//
//  人名红线可视化说明（组长后台视角）：
//
//  pendingFlags → [匿名卡片] → 点击 [请求关怀] → API pastoral/request
//                                                 ↓
//  requests  PENDING  → member_name = null  → 显示"等待回应"
//           DENIED   → member_name = null  → 显示"已婉拒"
//           APPROVED → member_name = "Lily" → 才显示真实姓名
//
// ════════════════════════════════════════════════════════
export function PastoralBoard({ pendingFlags: initialFlags, requests: initialRequests, fellowshipId }: PastoralBoardProps) {
  const [flags, setFlags]       = useState(initialFlags)
  const [requests, setRequests] = useState(initialRequests)
  const [requesting, setRequesting] = useState<string | null>(null)

  const handleRequestCare = useCallback(async (flagId: string) => {
    setRequesting(flagId)
    try {
      const res = await fetch('/api/pastoral/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ flag_id: flagId }),
      })
      if (res.ok) {
        // Remove from pending flags; optimistic (re-fetch would be more accurate)
        setFlags((prev) => prev.filter((f) => f.flag_id !== flagId))
        // Add a PENDING card optimistically
        const newCard: PastoralCard = {
          request_id:   `temp-${flagId}`,
          status:       'PENDING',
          created_at:   new Date().toISOString(),
          responded_at: null,
          member_name:  null,   // locked — as designed
        }
        setRequests((prev) => [newCard, ...prev])
      }
    } finally {
      setRequesting(null)
    }
  }, [])

  const hasActivity = flags.length > 0 || requests.length > 0

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">代祷关怀</h2>
        {flags.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/80 text-[10px] font-bold text-white">
            {flags.length}
          </span>
        )}
      </div>

      {!hasActivity && (
        <p className="text-sm text-muted-foreground py-3">暂无代祷需求</p>
      )}

      {/* ── Anonymous pending flags ───────────── */}
      {flags.map((flag) => (
        <div
          key={flag.flag_id}
          className="mb-3 flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-foreground">有组员标记了代祷需求</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(flag.flagged_at).toLocaleDateString('zh-CN')}
              {/* 无 status_tag、无 layer2_label — 完全匿名 */}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleRequestCare(flag.flag_id)}
            disabled={requesting === flag.flag_id}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5',
              'text-xs text-foreground hover:border-gold-300 hover:text-gold-700',
              'hover:bg-gold-400/8 transition-colors disabled:opacity-50',
            )}
          >
            {requesting === flag.flag_id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : '请求关怀'
            }
          </button>
        </div>
      ))}

      {/* ── Pastoral request cards ────────────── */}
      {requests.map((card) => (
        <PastoralRequestCard key={card.request_id} card={card} />
      ))}
    </section>
  )
}

// ── Individual request card ───────────────────────────────
function PastoralRequestCard({ card }: { card: PastoralCard }) {
  return (
    <div className={cn(
      'mb-2 flex items-start justify-between rounded-xl border px-4 py-3',
      card.status === 'APPROVED' && 'border-sage-200 bg-sage-50',
      card.status === 'PENDING'  && 'border-border bg-card',
      card.status === 'DENIED'   && 'border-border bg-muted/40 opacity-60',
    )}>
      <div className="flex-1 min-w-0">
        {/* Human-name display — the red line made visible in UI */}
        <p className="text-sm font-medium text-foreground">
          {card.status === 'APPROVED' && card.member_name
            ? card.member_name                    // ← 唯一显示人名的地方
            : card.status === 'DENIED'
              ? '已婉拒关怀'
              : '等待成员回应…'                   // PENDING: 名字锁定
          }
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(card.created_at).toLocaleDateString('zh-CN')} 发出关怀请求
          {card.responded_at && ` · ${new Date(card.responded_at).toLocaleDateString('zh-CN')} 回应`}
        </p>
      </div>

      {/* Status badge */}
      <span className={cn(
        'ml-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        card.status === 'APPROVED' && 'bg-sage-100 text-sage-700',
        card.status === 'PENDING'  && 'bg-oat-200 text-oat-700',
        card.status === 'DENIED'   && 'bg-muted text-muted-foreground',
      )}>
        {card.status === 'APPROVED' && <UserCheck className="h-3 w-3" />}
        {card.status === 'DENIED'   && <UserX     className="h-3 w-3" />}
        {card.status === 'APPROVED' ? '已授权' : card.status === 'DENIED' ? '已婉拒' : '等待中'}
      </span>
    </div>
  )
}
