'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  const handleSignOut = async () => {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100
                 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition-all
                 hover:bg-red-100 active:scale-[0.98] disabled:opacity-60"
    >
      {busy
        ? <><Loader2 className="h-4 w-4 animate-spin" />退出中…</>
        : <><LogOut className="h-4 w-4" />安全退出登录</>
      }
    </button>
  )
}
