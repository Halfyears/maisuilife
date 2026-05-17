/**
 * GET  /api/fellowship/music?fellowship_id=xxx
 * PUT  /api/fellowship/music
 *      Body: { fellowship_id, slots: MusicSlot[] }
 *
 * PUT replaces ALL slots for the fellowship (delete + insert).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface Song      { title: string; url: string }
export interface MusicSlot {
  id?:          string
  slot_name:    string
  slot_order:   number
  songs:        Song[]
  is_fixed:     boolean
}

async function getAuthedUser() {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const fellowshipId = req.nextUrl.searchParams.get('fellowship_id')
  if (!fellowshipId) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

  const db = createServiceClient()
  const { data } = await db
    .from('fellowship_music_slots')
    .select('id, slot_name, slot_order, songs, is_fixed')
    .eq('fellowship_id', fellowshipId)
    .order('slot_order')

  return NextResponse.json({ slots: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { fellowship_id, slots } = await req.json() as { fellowship_id: string; slots: MusicSlot[] }
  if (!fellowship_id) return NextResponse.json({ error: 'fellowship_id required' }, { status: 400 })

  const db = createServiceClient()

  // Replace all slots
  await db.from('fellowship_music_slots').delete().eq('fellowship_id', fellowship_id)

  if (slots.length > 0) {
    const rows = slots.map(s => ({
      fellowship_id,
      slot_name:  s.slot_name,
      slot_order: s.slot_order,
      songs:      s.songs,
      is_fixed:   s.is_fixed,
    }))
    const { error } = await db.from('fellowship_music_slots').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
