'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'

const ERROR_MAP: Record<string, string> = {
  unauthorized:           '请先登录',
  not_member:             '你不是该小组成员',
  already_left:           '你已退出该小组',
  organizer_cannot_leave: '召集人无法退出，请先「结束小组」',
  db_error:               '操作失败，请重试',
}

interface LeaveGroupButtonProps {
  groupId: string
}

export function LeaveGroupButton({ groupId }: LeaveGroupButtonProps) {
  const router  = useRouter()
  const [loading,  setLoading]  = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLeave() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/accountability/groups/${groupId}/members/self`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(ERROR_MAP[data.error] ?? '退出失败，请重试')
        setShowConf(false)
        return
      }
      // 成功退出：跳转回列表
      router.push('/accountability')
      router.refresh()
    } catch {
      setError('网络错误，请重试')
      setShowConf(false)
    } finally {
      setLoading(false)
    }
  }

  if (showConf) {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50/60 px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-orange-700">确认退出此小组？</p>
        <p className="text-xs text-orange-600 leading-relaxed">
          退出后你的历史打卡记录将被完整保留，但不再属于该小组，也不会出现在成员进度中。
          如需重新加入，请联系召集人获取邀请码。
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl
                       bg-orange-500 py-2.5 text-sm font-bold text-white
                       hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            确认退出
          </button>
          <button
            onClick={() => setShowConf(false)}
            disabled={loading}
            className="flex flex-1 items-center justify-center rounded-xl
                       border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-500
                       hover:bg-stone-50 disabled:opacity-60 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
      <button
        onClick={() => setShowConf(true)}
        className="w-full rounded-2xl border border-stone-200 bg-white py-2.5
                   text-sm font-medium text-stone-400
                   hover:border-orange-200 hover:text-orange-500 hover:bg-orange-50/50
                   transition-colors"
      >
        退出此小组
      </button>
    </div>
  )
}
