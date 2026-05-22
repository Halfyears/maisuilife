'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'

export function RejectButton({ fellowshipId, leaderId }: { fellowshipId: string; leaderId: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!confirm('确认拒绝该团契申请？')) return
    setLoading(true)
    try {
      await fetch('/api/church/fellowship/reject', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fellowship_id: fellowshipId }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handle} disabled={loading}
      className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5
                 text-xs font-bold text-red-600 hover:bg-red-100
                 disabled:opacity-50 transition-colors">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
      拒绝
    </button>
  )
}
