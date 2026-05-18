'use client'

import { useState } from 'react'
import { Pencil, Save, X, Loader2, CheckCircle, Clock, XCircle, PauseCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export interface FellowshipUser {
  id: string
  display_name: string
  role: string
}

interface Props {
  fellowship: {
    id: string
    name: string
    status: string
    invite_code: string
    leader_id: string
    created_at: string
  }
  memberCount: number
  allUsers: FellowshipUser[]
}

const STATUS_OPTIONS = [
  { value: 'approved',  label: '运行中', icon: CheckCircle, color: 'text-green-700 bg-green-50'  },
  { value: 'pending',   label: '待审批', icon: Clock,       color: 'text-orange-700 bg-orange-50' },
  { value: 'rejected',  label: '已拒绝', icon: XCircle,     color: 'text-red-600 bg-red-50'       },
  { value: 'suspended', label: '已暂停', icon: PauseCircle, color: 'text-stone-600 bg-stone-100'  },
]

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status) ?? STATUS_OPTIONS[0]
  const Icon = opt.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${opt.color}`}>
      <Icon className="h-3 w-3" />{opt.label}
    </span>
  )
}

export function FellowshipManageRow({ fellowship, memberCount, allUsers }: Props) {
  const router = useRouter()
  const [editing,    setEditing]    = useState(false)
  const [draftName,  setDraftName]  = useState(fellowship.name)
  const [draftLeader, setDraftLeader] = useState(fellowship.leader_id)
  const [draftStatus, setDraftStatus] = useState(fellowship.status)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const leaderName = allUsers.find(u => u.id === fellowship.leader_id)?.display_name ?? '—'

  function startEdit() {
    setDraftName(fellowship.name)
    setDraftLeader(fellowship.leader_id)
    setDraftStatus(fellowship.status)
    setEditing(true)
    setError(null)
  }

  function cancel() { setEditing(false); setError(null) }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/church/update-fellowship', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:        fellowship.id,
          name:      draftName.trim(),
          leader_id: draftLeader,
          status:    draftStatus,
        }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
      router.refresh()
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // Eligible leaders: group_leader, church_admin, super_admin, pastor
  const eligibleLeaders = allUsers.filter(u =>
    ['group_leader', 'church_admin', 'super_admin', 'pastor'].includes(u.role)
  )

  return (
    <tr className="border-b border-stone-50 hover:bg-violet-50/20 transition-colors">
      {editing ? (
        <td colSpan={6} className="px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium
                         text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-300 w-full sm:w-48"
              placeholder="团契名称"
            />
            <select
              value={draftLeader}
              onChange={e => setDraftLeader(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700
                         focus:outline-none focus:ring-2 focus:ring-violet-300 w-full sm:w-44"
            >
              <option value="">— 选择组长 —</option>
              {eligibleLeaders.map(u => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
            <select
              value={draftStatus}
              onChange={e => setDraftStatus(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700
                         focus:outline-none focus:ring-2 focus:ring-violet-300 w-full sm:w-32"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 shrink-0">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              ) : (
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
          </div>
        </td>
      ) : (
        <>
          <td className="px-4 py-3 font-medium text-stone-900 text-sm">{fellowship.name}</td>
          <td className="px-4 py-3 text-stone-600 text-sm">{leaderName}</td>
          <td className="px-4 py-3 text-stone-500 text-sm">{memberCount} 人</td>
          <td className="px-4 py-3 font-mono text-stone-400 text-xs tracking-wider">{fellowship.invite_code}</td>
          <td className="px-4 py-3"><StatusBadge status={fellowship.status} /></td>
          <td className="px-4 py-3 text-xs text-stone-400">{fellowship.created_at.slice(0, 10)}</td>
          <td className="px-4 py-3">
            <button onClick={startEdit}
              className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                         text-xs text-stone-500 hover:border-violet-300 hover:text-violet-600
                         hover:bg-violet-50 transition-colors">
              <Pencil className="h-3 w-3" />编辑
            </button>
          </td>
        </>
      )}
    </tr>
  )
}
