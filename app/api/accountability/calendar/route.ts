import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { AccountabilityGroup } from '@/types'

export const runtime = 'nodejs'

const DAY_ABBR: Record<number, string> = {
  1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU',
}

const VTIMEZONE_LA = [
  'BEGIN:VTIMEZONE',
  'TZID:America/Los_Angeles',
  'BEGIN:STANDARD',
  'DTSTART:19671029T020000',
  'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19870405T020000',
  'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n')

// GET /api/accountability/calendar?id=<groupId>
// Returns an .ics file for download
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('id')
  if (!groupId) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const db = createAdminClient()

  // Verify membership
  const { data: member } = await db
    .from('accountability_group_members')
    .select('display_name')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: groupData } = await db
    .from('accountability_groups')
    .select('*')
    .eq('id', groupId)
    .single()

  const group = groupData as AccountabilityGroup | null
  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const days: number[] = Array.isArray(group.schedule_days_of_week) ? group.schedule_days_of_week : []
  const title    = group.goal_title ?? group.name
  const desc     = group.goal_description ?? ''
  const timeStr  = group.schedule_time ?? '08:00'
  const [hh, mm] = timeStr.split(':').map(Number)

  // Build DTSTART — use group start_date, fall back to today in LA timezone
  const startBase = group.start_date
    ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
  const dtStart = startBase.replace(/-/g, '')
    + 'T'
    + String(hh).padStart(2, '0')
    + String(mm).padStart(2, '0')
    + '00'

  // RRULE: weekly on selected days, with optional UNTIL from end_date
  const byDay = days.map(d => DAY_ABBR[d]).filter(Boolean).join(',')
  let rrule = days.length > 0
    ? `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`
    : `RRULE:FREQ=DAILY`
  if (group.end_date) {
    rrule += `;UNTIL=${group.end_date.replace(/-/g, '')}T235959`
  }

  // Alarm: 30 min before
  const alarm = [
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:打卡提醒：${title}`,
    'END:VALARM',
  ].join('\r\n')

  const uid = `accountability-${groupId}@maisui-joy`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MaisuiJoy//Accountability//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    VTIMEZONE_LA,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=America/Los_Angeles:${dtStart}`,
    `DURATION:PT15M`,
    rrule,
    `SUMMARY:${title}`,
    desc ? `DESCRIPTION:${desc.replace(/\n/g, '\\n')}` : '',
    alarm,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const filename = encodeURIComponent(`${group.name}-打卡提醒.ics`)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
