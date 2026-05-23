'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Trash2, RefreshCw, Users, ExternalLink,
  Loader2, ChevronRight, Building2, GitBranch, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'deleted' | 'fellowships' | 'groups'

interface DeletedRecord {
  id: string
  name: string
  deleted_at: string
  group_type?: string
}

interface FellowshipRecord {
  id: string
  name: string
  status: string
  invite_code: string
  leader_id: string | null
  member_count: number
}

interface GroupRecord {
  id: string
  name: string
  group_type: string
  status: string
  organizer_id: string | null
  member_count: number
}

interface DeletedData {
  churches:    DeletedRecord[]
  fellowships: DeletedRecord[]
  groups:      DeletedRecord[]
}

const STATUS_LABEL: Record<string, string> = {
  pending:  '待审批',
  approved: '正常',
  archived: '已归档',
  deleted:  '已删除',
  active:   '正常',
  ended:    '已结束',
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'text-green-700 bg-green-50 border-green-200',
  active:   'text-green-700 bg-green-50 border-green-200',
  pending:  'text-amber-700 bg-amber-50 border-amber-200',
  archived: 'text-stone-600 bg-stone-50 border-stone-200',
  ended:    'text-stone-600 bg-stone-50 border-stone-200',
  deleted:  'text-red-600 bg-red-50 border-red-200',
}

export function GovernanceCard() {
  const router      = useRouter()
  const [tab,       setTab]       = useState<Tab>('deleted')
  const [deleted,   setDeleted]   = useState<DeletedData | null>(null)
  const [allData,   setAllData]   = useState<{ fellowships: FellowshipRecord[]; groups: GroupRecord[] } | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [actionId,  setActionId]  = useState<string | null>(null)

  const loadDeleted = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/deleted-records')
      if (res.ok) setDeleted(await res.json())
    } finally { setLoading(false) }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/all-records')
      if (res.ok) setAllData(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'deleted')      loadDeleted()
    else if (tab !== 'deleted') loadAll()
  }, [tab, loadDeleted, loadAll])

  async function restore(type: 'church' | 'fellowship' | 'group', id: string) {
    setActionId(id)
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      })
      if (res.ok) { await loadDeleted(); router.refresh() }
    } finally { setActionId(null) }
  }

  async function takeover(type: 'fellowship' | 'group', id: string) {
    if (!confirm('确认强制接管？您将成为此记录的新负责人。')) return
    setActionId(id)
    try {
      const res = await fetch('/api/admin/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      })
      if (res.ok) { await loadAll(); router.refresh() }
    } finally { setActionId(null) }
  }

  const deletedTotal = deleted
    ? deleted.churches.length + deleted.fellowships.length + deleted.groups.length
    : 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
          <Shield className="h-4 w-4 text-violet-500" />
        </div>
        <h2 className="font-semibold text-foreground">全局治理</h2>
        <span className="ml-auto text-xs text-muted-foreground">super_admin 专属</span>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1 rounded-xl bg-muted/40 p-1">
        {([
          ['deleted',      '已删除',   deletedTotal > 0 ? String(deletedTotal) : undefined],
          ['fellowships',  '所有团契',  undefined],
          ['groups',       '所有小组',  undefined],
        ] as [Tab, string, string | undefined][]).map(([key, label, badge]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              tab === key
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {badge && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">加载中…</span>
        </div>
      ) : tab === 'deleted' ? (
        <DeletedTab data={deleted} actionId={actionId} onRestore={restore} />
      ) : tab === 'fellowships' ? (
        <FellowshipsTab
          data={allData?.fellowships ?? []}
          actionId={actionId}
          onTakeover={takeover}
        />
      ) : (
        <GroupsTab
          data={allData?.groups ?? []}
          actionId={actionId}
          onTakeover={takeover}
        />
      )}
    </div>
  )
}

// ── 已删除标签 ────────────────────────────────────────────────────────────────

function DeletedTab({
  data, actionId, onRestore,
}: {
  data: DeletedData | null
  actionId: string | null
  onRestore: (type: 'church' | 'fellowship' | 'group', id: string) => void
}) {
  if (!data) return null

  const sections: { type: 'church' | 'fellowship' | 'group'; label: string; icon: React.ReactNode; rows: DeletedRecord[] }[] = [
    { type: 'church',      label: '教会',    icon: <Building2 className="h-3.5 w-3.5" />, rows: data.churches },
    { type: 'fellowship',  label: '团契',    icon: <GitBranch className="h-3.5 w-3.5" />, rows: data.fellowships },
    { type: 'group',       label: '同行小组', icon: <Target className="h-3.5 w-3.5" />,    rows: data.groups },
  ]

  const total = sections.reduce((s, sec) => s + sec.rows.length, 0)
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Trash2 className="h-8 w-8 opacity-30" />
        <p className="text-sm">暂无已删除记录</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map(sec => sec.rows.length > 0 && (
        <div key={sec.type}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2 px-1">
            {sec.icon} {sec.label}
          </div>
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {sec.rows.map(row => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    删除于 {new Date(row.deleted_at).toLocaleDateString('zh-CN')}
                    {row.group_type === 'vigil' && ' · 守望相助'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={() => onRestore(sec.type, row.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50
                             px-3 py-1.5 text-xs font-semibold text-green-700
                             hover:bg-green-100 disabled:opacity-50 transition-colors shrink-0"
                >
                  {actionId === row.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  恢复
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 所有团契标签 ──────────────────────────────────────────────────────────────

function FellowshipsTab({
  data, actionId, onTakeover,
}: {
  data: FellowshipRecord[]
  actionId: string | null
  onTakeover: (type: 'fellowship' | 'group', id: string) => void
}) {
  if (data.length === 0) {
    return <EmptyState icon={<GitBranch className="h-8 w-8 opacity-30" />} text="暂无团契" />
  }
  return (
    <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
      {data.map(f => (
        <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                STATUS_COLOR[f.status] ?? STATUS_COLOR['active'],
              )}>
                {STATUS_LABEL[f.status] ?? f.status}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Users className="h-3 w-3" /> {f.member_count}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`/fellowship/console?id=${f.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/30
                         px-2.5 py-1.5 text-xs font-medium text-foreground
                         hover:border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              进入
            </a>
            <button
              type="button"
              disabled={actionId === f.id}
              onClick={() => onTakeover('fellowship', f.id)}
              className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50
                         px-2.5 py-1.5 text-xs font-semibold text-violet-700
                         hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              {actionId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
              接管
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 所有小组标签 ──────────────────────────────────────────────────────────────

function GroupsTab({
  data, actionId, onTakeover,
}: {
  data: GroupRecord[]
  actionId: string | null
  onTakeover: (type: 'fellowship' | 'group', id: string) => void
}) {
  if (data.length === 0) {
    return <EmptyState icon={<Target className="h-8 w-8 opacity-30" />} text="暂无同行小组" />
  }
  return (
    <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
      {data.map(g => (
        <div key={g.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {g.group_type === 'vigil' ? '🕊️' : '🌿'} {g.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                STATUS_COLOR[g.status] ?? STATUS_COLOR['active'],
              )}>
                {STATUS_LABEL[g.status] ?? g.status}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Users className="h-3 w-3" /> {g.member_count}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`/accountability/${g.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/30
                         px-2.5 py-1.5 text-xs font-medium text-foreground
                         hover:border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
              进入
            </a>
            <button
              type="button"
              disabled={actionId === g.id}
              onClick={() => onTakeover('group', g.id)}
              className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50
                         px-2.5 py-1.5 text-xs font-semibold text-violet-700
                         hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              {actionId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
              接管
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  )
}
