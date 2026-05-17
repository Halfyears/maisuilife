'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle } from 'lucide-react'

export function ApproveButton({ fellowshipId, leaderId }: { fellowshipId: string; leaderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    try {
      await fetch('/api/church/fellowship/approve', {
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
      className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5
                 text-xs font-bold text-white hover:bg-green-600
                 disabled:opacity-50 transition-colors">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
      批准
    </button>
  )
}
