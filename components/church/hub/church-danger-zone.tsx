'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PowerOff } from 'lucide-react'

interface Props {
  churchId:   string
  churchName: string
}

export function ChurchDangerZone({ churchId, churchName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function disableChurch() {
    if (!confirm(`确认停用教会「${churchName}」？\n停用后成员将无法加入，数据完整保留，超管可随时恢复。`)) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/church/update-church-status', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ church_id: churchId, status: 'inactive' }),
      })
      if (!res.ok) { setError('操作失败，请重试'); return }
      router.refresh()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-50/40 px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-orange-700">教会危险操作（仅超级管理员）</p>
      <button
        type="button"
        onClick={disableChurch}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-200
                   bg-white py-2.5 text-sm font-bold text-orange-600
                   hover:bg-orange-50 disabled:opacity-50 transition-colors"
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <PowerOff className="h-4 w-4" />}
        停用教会
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-[11px] text-orange-400">
        停用后教会状态变为「已停用」，所有数据保留，可由超管在全局治理中恢复。
        如需永久删除，请联系系统工程师操作数据库。
      </p>
    </div>
  )
}
