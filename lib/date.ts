import { cookies } from 'next/headers'

// Returns the client's local date (YYYY-MM-DD) written by ClientDateSync.
// On the very first request (before the cookie lands), falls back to UTC —
// ClientDateSync will detect the mismatch and call router.refresh() immediately.
export function todayLocal(): string {
  const c = cookies().get('x_local_date')?.value
  if (c && /^\d{4}-\d{2}-\d{2}$/.test(c)) return c
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// Pure arithmetic offset from a YYYY-MM-DD base string. No timezone hardcoding.
export function offsetDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
