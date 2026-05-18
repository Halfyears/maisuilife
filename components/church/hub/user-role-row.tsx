'use client'

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
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
  user: { id: string; display_name: string; role: string; created_at: string }
  actorRole: string
  fellowship?: string
}

export function UserRoleRow({ user: u, actorRole, fellowship }: Props) {
  const router = useRouter()
  const [draft,   setDraft]   = useState(u.role)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const assignable = actorRole === 'super_admin'
    ? SUPER_ADMIN_ASSIGNABLE
    : CHURCH_ADMIN_ASSIGNABLE

  const changed = draft !== u.role

  async function save() {
    if (!changed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/church/update-user-role', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: u.id, role: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg: Record<string, string> = {
          cannot_change_own_role: '不能修改自己的角色',
          permission_denied: '权限不足',
        }
        setError(msg[data.error] ?? '保存失败')
        setDraft(u.role)
        return
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      router.refresh()
    } catch {
      setError('保存失败')
      setDraft(u.role)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
      <td className="px-4 py-2.5 font-medium text-stone-900 text-sm">{u.display_name || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-stone-400">{u.created_at.slice(0, 10)}</td>
      <td className="px-4 py-2.5 text-xs text-stone-500">{fellowship ?? '—'}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <select
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(null) }}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700
                       focus:outline-none focus:ring-2 focus:ring-violet-300 transition-colors"
          >
            {assignable.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
            {/* Show current role even if not assignable by this actor */}
            {!assignable.includes(u.role) && (
              <option value={u.role} disabled>{ROLE_LABELS[u.role] ?? u.role}</option>
            )}
          </select>
          {changed && (
            saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
            ) : (
              <button
                onClick={save}
                className="flex items-center gap-1 rounded-lg bg-violet-500 px-2 py-1
                           text-xs font-bold text-white hover:bg-violet-600 transition-colors"
              >
                <Save className="h-3 w-3" />保存
              </button>
            )
          )}
          {success && <span className="text-xs text-green-600 font-medium">✓</span>}
          {error   && <span className="text-xs text-red-500">{error}</span>}
        </div>
      </td>
    </tr>
  )
}
