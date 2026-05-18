'use client'

import { useEffect } from 'react'

// Runs on every page load, writes the client's local date to a cookie.
// Server components read this cookie via lib/date.ts → todayLocal().
export function ClientDateSync() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    document.cookie = `x_local_date=${today}; path=/; max-age=90000; SameSite=Lax`
  }, [])
  return null
}
