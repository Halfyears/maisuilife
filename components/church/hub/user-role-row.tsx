'use client'

import { useState } from 'react'
import { Save, Loader2, Trash2, UserX, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  super_admin:  '⚡ 超级管理员',
  church_admin: '⛪ 教会管理员',
  pastor:       '👑 牧师',
  group_leader: '🌱 组长',
  user:         '🌾 成员',
}

const CHURCH_ADMIN_ASSIGNABLE = ['user', 'group_leader', 'pastor']
const SUPER_ADMIN_ASSIGNABLE  = ['user', 'group_leader', 'pastor', 'church_admin', 'super_admin']

interface Props {
  user: { id: string; display_name: string; role: string; created_at: string; is_active: boolean }
  actorRole: string
  fellowship?: string
}

export function UserRoleRow({ user: u, actorRole, fellowship }: Props) {
  const router = useRouter()
  const [draft,      setDraft]      = useState(u.role)
  const [saving,     setSaving]     = useState(false)
  const [toggling,   setToggling]   = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)
  const [isActive,   setIsActive]   = useState(u.is_active)

  const assignable = actorRole === 'super_admin' ? SUPER_ADMIN_ASSIGNABLE : CHURCH_ADMIN_ASSIGNABLE
  const changed = draft !== u.role
  const canManage = ['church_admin', 'super_admin'].includes(actorRole)
  const canDelete = actorRole === 'super_admin'

  async function save() {
    if (!changed) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/church/update-user-role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id, role: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = {
          cannot_change_own_role: '不能修改自己的角色',
          permission_denied: '权限不足',
        }
        setError(msgs[data.error] ?? '保存失败')
        setDraft(u.role); return
      }
      setSuccess(true); setTimeout(() => setSuccess(false), 2000)
      router.refresh()
    } catch { setError('保存失败'); setDraft(u.role) }
    finally   { setSaving(false) }
  }

  async function toggleActive() {
    setToggling(true); setError(null)
    const next = !isActive
    try {
      const res = await fetch('/api/church/update-user-status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id, is_active: next }),
      })
      if (!res.ok) { setError('操作失败'); return }
      setIsActive(next); router.refresh()
    } catch { setError('网络错误') }
    finally   { setToggling(false) }
  }

  async function deleteUser() {
    if (!confirm(`确认删除用户「${u.display_name || u.id}」？此操作不可恢复。`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/church/delete-user', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id }),
      })
      if (!res.ok) { setError('删除失败'); return }
      router.refresh()
    } catch { setError('网络错误') }
    finally   { setDeleting(false) }
  }

  const roleSelect = (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={draft} onChange={e => { setDraft(e.target.value); setError(null) }}
        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700
                   focus:outline-none focus:ring-2 focus:ring-violet-300 transition-colors">
        {assignable.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
        {!assignable.includes(u.role) && (
          <option value={u.role} disabled>{ROLE_LABELS[u.role] ?? u.role}</option>
        )}
      </select>
      {changed && (
        saving
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
          : <button onClick={save}
              className="flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1.5
                         text-xs font-bold text-white hover:bg-violet-600 transition-colors">
              <Save className="h-3 w-3" />保存
            </button>
      )}
      {success && <span className="text-xs text-green-600 font-medium">✓ 已保存</span>}
      {error   && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )

  const actionButtons = canManage && (
    <div className="flex items-center gap-1.5 mt-1">
      <button onClick={toggleActive} disabled={toggling}
        className={[
          'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
          isActive
            ? 'border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50'
            : 'border-green-200 text-green-600 hover:bg-green-50 bg-green-50/50',
        ].join(' ')}>
        {toggling
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
        {isActive ? '停用' : '激活'}
      </button>
      {canDelete && (
        <button onClick={deleteUser} disabled={deleting}
          className="flex items-center gap-1 rounded-lg border border-red-100 px-2 py-1
                     text-xs text-red-400 hover:border-red-300 hover:text-red-600
                     hover:bg-red-50 disabled:opacity-50 transition-colors">
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          删除
        </button>
      )}
    </div>
  )

  // ── Mobile card ───────────────────────────────────────────────────────────
  const mobileCard = (
    <div className={['px-4 py-3 space-y-2 md:hidden', !isActive ? 'opacity-60' : ''].join(' ')}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-stone-900 truncate">{u.display_name || '—'}</p>
            {!isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-400">已停用</span>}
          </div>
          <p className="text-xs text-stone-400">{fellowship ?? '未入团契'} · {u.created_at.slice(0, 10)}</p>
        </div>
      </div>
      {roleSelect}
      {actionButtons}
    </div>
  )

  // ── Desktop row ───────────────────────────────────────────────────────────
  const desktopRow = (
    <tr className={['border-b border-stone-50 hover:bg-stone-50/50 transition-colors hidden md:table-row', !isActive ? 'opacity-60' : ''].join(' ')}>
      <td className="px-4 py-2.5 font-medium text-stone-900 text-sm">
        <div className="flex items-center gap-1.5">
          {u.display_name || '—'}
          {!isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-400">已停用</span>}
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-stone-400">{u.created_at.slice(0, 10)}</td>
      <td className="px-4 py-2.5 text-xs text-stone-500">{fellowship ?? '—'}</td>
      <td className="px-4 py-2.5">
        {roleSelect}
        {actionButtons}
      </td>
    </tr>
  )

  return <>{mobileCard}{desktopRow}</>
}
