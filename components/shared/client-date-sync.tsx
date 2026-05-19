'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Returns YYYY-MM-DD in the browser's own local timezone — never UTC.
function localDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCookieDate(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)x_local_date=([^;]+)/)
  return match ? match[1] : null
}

// Runs on every page load:
// 1. Writes the browser's actual local date to x_local_date cookie.
// 2. If the cookie was stale or missing, calls router.refresh() so Server
//    Components re-render with the correct date — no full page reload needed.
export function ClientDateSync() {
  const router = useRouter()

  useEffect(() => {
    const today = localDateString()
    const prev  = getCookieDate()
    document.cookie = `x_local_date=${today}; path=/; max-age=90000; SameSite=Lax`
    if (prev !== today) {
      router.refresh()
    }
  }, [router])

  return null
}
