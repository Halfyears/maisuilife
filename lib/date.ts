import { cookies } from 'next/headers'

// Returns the client's local date (YYYY-MM-DD) set by ClientDateSync.
// Falls back to Los Angeles local time on the first request (before the cookie is written).
export function todayLocal(): string {
  const c = cookies().get('x_local_date')?.value
  if (c && /^\d{4}-\d{2}-\d{2}$/.test(c)) return c
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}
