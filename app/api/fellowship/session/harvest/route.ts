import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateHarvestScriptures } from '@/lib/ai/gemini'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const session_id = typeof body.session_id === 'string' ? body.session_id : ''
  if (!session_id) return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })

  const db = createAdminClient()

  const { data: session } = await db
    .from('fellowship_sessions')
    .select('id, fellowship_id, organizer_id, expected_count, state')
    .eq('id', session_id)
    .single()
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (session.state !== 'checkin') return NextResponse.json({ error: 'wrong_state' }, { status: 400 })

  // Auth: organizer or privileged
  const { data: prof } = await db.from('users').select('role').eq('id', user.id).single()
  const isOrg = session.organizer_id === user.id
  const isPriv = ['church_admin','super_admin'].includes(prof?.role ?? '')
  if (!isOrg && !isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Get current wheat count and apply padding
  const { data: fellowship } = await db
    .from('fellowships').select('wheat_count').eq('id', session.fellowship_id).single()
  const raw = fellowship?.wheat_count ?? 0
  const floor = session.expected_count * 4
  const wheat_total = raw < floor
    ? session.expected_count * (4 + Math.floor(Math.random() * 3)) // 4..6
    : raw

  // Get recent mood words for scripture context
  const { data: recentMoods } = await db
    .from('daily_alignments').select('status_tag')
    .eq('is_visible', true)
    .gte('date', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
    .in('user_id',
      (await db.from('fellowship_members').select('user_id').eq('fellowship_id', session.fellowship_id))
        .data?.map((m: { user_id: string }) => m.user_id) ?? []
    )
  const moodWords = [...new Set((recentMoods ?? []).map((r: { status_tag: string }) => r.status_tag).filter(Boolean))]

  // Generate 3 scripture cards
  let scripture_cards: { verse: string; ref: string }[] = []
  try {
    scripture_cards = await generateHarvestScriptures(moodWords)
  } catch {
    scripture_cards = [
      { verse: '我靠着那加给我力量的，凡事都能做。', ref: '腓立比书 4:13' },
      { verse: '你们要将一切的忧虑卸给神，因为他顾念你们。', ref: '彼得前书 5:7' },
      { verse: '耶和华是我的牧者，我必不至缺乏。', ref: '诗篇 23:1' },
    ]
  }

  // Update session to harvest state
  await db.from('fellowship_sessions').update({
    state: 'harvest',
    wheat_total,
    scripture_cards,
    harvested_at: new Date().toISOString(),
  }).eq('id', session_id)

  return NextResponse.json({ wheat_total, scripture_cards })
}
