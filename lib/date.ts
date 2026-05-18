import { cookies } from 'next/headers'

// Returns the client's local date (YYYY-MM-DD) set by ClientDateSync.
// Falls back to UTC+8 on the first request (before the cookie is written).
export function todayLocal(): string {
  const c = cookies().get('x_local_date')?.value
  if (c && /^\d{4}-\d{2}-\d{2}$/.test(c)) return c
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}
