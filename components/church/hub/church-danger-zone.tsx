'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, StopCircle, Trash2 } from 'lucide-react'

interface Props {
  churchId: string
  churchName: string
}

export function ChurchDangerZone({ churchId, churchName }: Props) {
  const router = useRouter()
  const [ending,   setEnding]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function endChurch() {
    if (!confirm(`确认结束教会「${churchName}」？状态变更为「已结束」，数据保留。`)) return
    setEnding(true); setError(null)
    try {
      const res = await fetch('/api/church/update-church-status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: churchId, status: 'ended' }),
      })
      if (!res.ok) { setError('操作失败'); return }
      router.refresh()
    } catch { setError('网络错误') }
    finally   { setEnding(false) }
  }

  async function deleteChurch() {
    if (!confirm(`确认删除教会「${churchName}」？此操作不可恢复，所有团契、成员关联将被清除。`)) return
    setDeleting(true); setError(null)
    try {
      const res = await fetch('/api/church/delete-church', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: churchId }),
      })
      if (!res.ok) { setError('删除失败'); return }
      router.refresh()
    } catch { setError('网络错误') }
    finally   { setDeleting(false) }
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/40 px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-red-700">教会危险操作（仅超级管理员）</p>
      <div className="flex gap-2">
        <button onClick={endChurch} disabled={ending || deleting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-orange-200
                     bg-white py-2.5 text-xs font-bold text-orange-600
                     hover:bg-orange-50 disabled:opacity-50 transition-colors">
          {ending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
          结束教会
        </button>
        <button onClick={deleteChurch} disabled={ending || deleting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-200
                     bg-white py-2.5 text-xs font-bold text-red-600
                     hover:bg-red-50 disabled:opacity-50 transition-colors">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          删除教会
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-[11px] text-red-400">结束保留数据；删除彻底清除教会及所有成员关联，不可恢复。</p>
    </div>
  )
}
