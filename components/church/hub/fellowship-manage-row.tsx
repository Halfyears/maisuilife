'use client'

import { useState } from 'react'
import { Pencil, Save, X, Loader2, CheckCircle, Clock, XCircle, PauseCircle, StopCircle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export interface FellowshipUser {
  id: string; display_name: string; role: string
}

interface Props {
  fellowship: {
    id: string; name: string; status: string; invite_code: string;
    leader_id: string | null; created_at: string
  }
  memberCount: number
  allUsers: FellowshipUser[]
}

const STATUS_OPTIONS = [
  { value: 'approved',  label: '运行中', Icon: CheckCircle,  color: 'text-green-700 bg-green-50'  },
  { value: 'pending',   label: '待审批', Icon: Clock,        color: 'text-orange-700 bg-orange-50' },
  { value: 'rejected',  label: '已拒绝', Icon: XCircle,      color: 'text-red-600 bg-red-50'       },
  { value: 'suspended', label: '已暂停', Icon: PauseCircle,  color: 'text-stone-600 bg-stone-100'  },
  { value: 'ended',     label: '已结束', Icon: StopCircle,   color: 'text-stone-400 bg-stone-50'   },
]

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status) ?? STATUS_OPTIONS[0]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${opt.color}`}>
      <opt.Icon className="h-3 w-3" />{opt.label}
    </span>
  )
}

export function FellowshipManageRow({ fellowship, memberCount, allUsers }: Props) {
  const router = useRouter()
  const [editing,     setEditing]     = useState(false)
  const [draftName,   setDraftName]   = useState(fellowship.name)
  const [draftLeader, setDraftLeader] = useState(fellowship.leader_id ?? '')
  const [draftStatus, setDraftStatus] = useState(fellowship.status)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const leaderName = allUsers.find(u => u.id === fellowship.leader_id)?.display_name ?? '—'
  const eligibleLeaders = allUsers.filter(u =>
    ['group_leader', 'church_admin', 'super_admin', 'pastor'].includes(u.role)
  )

  function startEdit() {
    setDraftName(fellowship.name); setDraftLeader(fellowship.leader_id ?? '')
    setDraftStatus(fellowship.status); setEditing(true); setError(null)
  }

  async function deleteFellowship() {
    if (!confirm(`确认删除团契「${fellowship.name}」？此操作不可恢复，所有成员记录将被清除。`)) return
    setDeleting(true)
    try {
      await fetch('/api/church/delete-fellowship', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fellowship_id: fellowship.id }),
      })
      router.refresh()
    } catch { setError('删除失败') }
    finally   { setDeleting(false) }
  }
  function cancel() { setEditing(false); setError(null) }

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/church/update-fellowship', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:        fellowship.id,
          name:      draftName.trim(),
          status:    draftStatus,
          ...(draftLeader ? { leader_id: draftLeader } : {}),
        }),
      })
      if (!res.ok) throw new Error()
      setEditing(false); router.refresh()
    } catch { setError('保存失败，请重试') }
    finally   { setSaving(false) }
  }

  // ── Edit form (shared mobile/desktop) ────────────────────────────────────
  const editForm = (
    <div className="space-y-3">
      <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)}
        placeholder="团契名称"
        className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium
                   text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-300" />
      <select value={draftLeader} onChange={e => setDraftLeader(e.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700
                   focus:outline-none focus:ring-2 focus:ring-violet-300">
        <option value="">— 选择组长 —</option>
        {eligibleLeaders.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
      </select>
      <select value={draftStatus} onChange={e => setDraftStatus(e.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700
                   focus:outline-none focus:ring-2 focus:ring-violet-300">
        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
          <>
            <button onClick={save}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-violet-500 py-2.5
                         text-sm font-bold text-white hover:bg-violet-600 transition-colors">
              <Save className="h-4 w-4" />保存
            </button>
            <button onClick={cancel}
              className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-500
                         hover:bg-stone-100 transition-colors">
              取消
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── Mobile card ───────────────────────────────────────────────────────────
  const mobileView = (
    <div className="px-4 py-4 md:hidden">
      {editing ? editForm : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-stone-900 text-sm truncate">{fellowship.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              组长：{leaderName} · {memberCount} 人 · {fellowship.created_at.slice(0, 10)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={fellowship.status} />
            <div className="flex gap-1.5">
              <button onClick={startEdit}
                className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                           text-xs text-stone-500 hover:border-violet-300 hover:text-violet-600
                           hover:bg-violet-50 transition-colors">
                <Pencil className="h-3 w-3" />编辑
              </button>
              <button onClick={deleteFellowship} disabled={deleting}
                className="flex items-center gap-1 rounded-lg border border-red-100 px-2.5 py-1
                           text-xs text-red-400 hover:border-red-300 hover:text-red-600
                           hover:bg-red-50 disabled:opacity-50 transition-colors">
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Desktop table row ─────────────────────────────────────────────────────
  const desktopRow = editing ? (
    <tr className="border-b border-stone-50 hidden md:table-row bg-violet-50/30">
      <td colSpan={7} className="px-4 py-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input value={draftName} onChange={e => setDraftName(e.target.value)}
            className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium
                       text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-300 w-44"
            placeholder="团契名称" />
          <select value={draftLeader} onChange={e => setDraftLeader(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700
                       focus:outline-none focus:ring-2 focus:ring-violet-300 w-40">
            <option value="">— 选择组长 —</option>
            {eligibleLeaders.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
          <select value={draftStatus} onChange={e => setDraftStatus(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700
                       focus:outline-none focus:ring-2 focus:ring-violet-300 w-28">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
            <>
              <button onClick={save}
                className="flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5
                           text-xs font-bold text-white hover:bg-violet-600 transition-colors">
                <Save className="h-3 w-3" />保存
              </button>
              <button onClick={cancel}
                className="rounded-lg border border-stone-200 p-1.5 text-stone-400
                           hover:bg-stone-100 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      </td>
    </tr>
  ) : (
    <tr className="border-b border-stone-50 hover:bg-violet-50/20 transition-colors hidden md:table-row">
      <td className="px-4 py-3 font-medium text-stone-900 text-sm">{fellowship.name}</td>
      <td className="px-4 py-3 text-stone-600 text-sm">{leaderName}</td>
      <td className="px-4 py-3 text-stone-500 text-sm">{memberCount} 人</td>
      <td className="px-4 py-3 font-mono text-stone-400 text-xs tracking-wider">{fellowship.invite_code}</td>
      <td className="px-4 py-3"><StatusBadge status={fellowship.status} /></td>
      <td className="px-4 py-3 text-xs text-stone-400">{fellowship.created_at.slice(0, 10)}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <button onClick={startEdit}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                       text-xs text-stone-500 hover:border-violet-300 hover:text-violet-600
                       hover:bg-violet-50 transition-colors">
            <Pencil className="h-3 w-3" />编辑
          </button>
          <button onClick={deleteFellowship} disabled={deleting}
            className="flex items-center gap-1 rounded-lg border border-red-100 px-2.5 py-1
                       text-xs text-red-400 hover:border-red-300 hover:text-red-600
                       hover:bg-red-50 disabled:opacity-50 transition-colors">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </td>
    </tr>
  )

  return <>{mobileView}{desktopRow}</>
}
