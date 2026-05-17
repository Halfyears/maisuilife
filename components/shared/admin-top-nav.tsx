'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Home, LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AdminTopNav({ backLabel = '返回主大盘', backHref = '/' }: {
  backLabel?: string
  backHref?: string
}) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  const handleSignOut = async () => {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                   px-3 py-1.5 text-xs font-medium text-stone-600
                   hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        {backLabel}
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50
                   px-3 py-1.5 text-xs font-bold text-red-600
                   hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50"
      >
        {busy
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <LogOut className="h-3.5 w-3.5" />
        }
        {busy ? '退出中…' : '安全退出'}
      </button>
    </div>
  )
}
