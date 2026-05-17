'use client'

import { useState, useTransition } from 'react'
import { Music, Plus, Trash2, GripVertical, Save, Loader2, CheckCircle2, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Song, MusicSlot } from '@/app/api/fellowship/music/route'

interface MusicPlannerProps {
  fellowshipId:  string
  initialSlots:  MusicSlot[]
}

const DEFAULT_SLOTS: MusicSlot[] = [
  { slot_name: '聚会开始', slot_order: 0,   songs: [], is_fixed: true },
  { slot_name: '聚会结束', slot_order: 999, songs: [], is_fixed: true },
]

function mergeWithDefaults(saved: MusicSlot[]): MusicSlot[] {
  if (saved.length === 0) return DEFAULT_SLOTS
  const hasOpening = saved.some(s => s.is_fixed && s.slot_order === 0)
  const hasClosing = saved.some(s => s.is_fixed && s.slot_order === 999)
  const result = [...saved]
  if (!hasOpening) result.unshift(DEFAULT_SLOTS[0])
  if (!hasClosing) result.push(DEFAULT_SLOTS[1])
  return result.sort((a, b) => a.slot_order - b.slot_order)
}

export function MusicPlanner({ fellowshipId, initialSlots }: MusicPlannerProps) {
  const [slots,   setSlots]   = useState<MusicSlot[]>(() => mergeWithDefaults(initialSlots))
  const [isSaving, startSave] = useTransition()
  const [saved,    setSaved]  = useState(false)

  // ── Slot operations ───────────────────────────────────
  function addCustomSlot() {
    const customSlots = slots.filter(s => !s.is_fixed)
    const maxOrder    = customSlots.length > 0
      ? Math.max(...customSlots.map(s => s.slot_order))
      : 0
    const newSlot: MusicSlot = {
      slot_name:  '自定义环节',
      slot_order: Math.min(maxOrder + 1, 998),
      songs:      [],
      is_fixed:   false,
    }
    setSlots(prev => [...prev, newSlot].sort((a, b) => a.slot_order - b.slot_order))
  }

  function removeSlot(idx: number) {
    setSlots(prev => prev.filter((_, i) => i !== idx))
  }

  function renameSlot(idx: number, name: string) {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, slot_name: name } : s))
  }

  // ── Song operations ───────────────────────────────────
  function addSong(slotIdx: number) {
    setSlots(prev => prev.map((s, i) =>
      i !== slotIdx ? s : { ...s, songs: [...s.songs, { title: '', url: '' }] }
    ))
  }

  function updateSong(slotIdx: number, songIdx: number, field: keyof Song, value: string) {
    setSlots(prev => prev.map((s, i) =>
      i !== slotIdx ? s : {
        ...s,
        songs: s.songs.map((sg, j) => j !== songIdx ? sg : { ...sg, [field]: value }),
      }
    ))
  }

  function removeSong(slotIdx: number, songIdx: number) {
    setSlots(prev => prev.map((s, i) =>
      i !== slotIdx ? s : { ...s, songs: s.songs.filter((_, j) => j !== songIdx) }
    ))
  }

  // ── Save ──────────────────────────────────────────────
  function handleSave() {
    setSaved(false)
    startSave(async () => {
      await fetch('/api/fellowship/music', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fellowship_id: fellowshipId, slots }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-foreground">音乐排单</h2>
        </div>
        <button
          type="button"
          onClick={addCustomSlot}
          className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50
                     px-3 py-1.5 text-xs font-semibold text-indigo-700
                     hover:bg-indigo-100 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          添加环节
        </button>
      </div>

      {/* Slots */}
      <div className="space-y-4">
        {slots.map((slot, slotIdx) => (
          <SlotBlock
            key={`${slot.slot_name}-${slotIdx}`}
            slot={slot}
            slotIdx={slotIdx}
            onRename={renameSlot}
            onRemove={removeSlot}
            onAddSong={addSong}
            onUpdateSong={updateSong}
            onRemoveSong={removeSong}
          />
        ))}
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
          saved
            ? 'border border-green-200 bg-green-50 text-green-700'
            : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:opacity-90 disabled:opacity-50',
        )}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved    && <CheckCircle2 className="h-4 w-4" />}
        {saved ? '已保存' : '保存排单'}
      </button>
    </div>
  )
}

// ── Individual slot block ─────────────────────────────────────────────
function SlotBlock({
  slot, slotIdx,
  onRename, onRemove, onAddSong, onUpdateSong, onRemoveSong,
}: {
  slot:         MusicSlot
  slotIdx:      number
  onRename:     (i: number, name: string) => void
  onRemove:     (i: number) => void
  onAddSong:    (i: number) => void
  onUpdateSong: (si: number, gi: number, f: keyof Song, v: string) => void
  onRemoveSong: (si: number, gi: number) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(slot.slot_name)

  function commitRename() {
    setEditingName(false)
    if (nameInput.trim()) onRename(slotIdx, nameInput.trim())
    else setNameInput(slot.slot_name)
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/60 px-4 py-3 space-y-3">
      {/* Slot header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {slot.is_fixed
            ? <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                {slot.slot_name}
              </span>
            : editingName
              ? <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => e.key === 'Enter' && commitRename()}
                  maxLength={20}
                  className="rounded-lg border border-indigo-300 bg-white px-2 py-0.5 text-sm
                             font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              : <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-bold text-stone-600
                             hover:bg-stone-300 transition-colors"
                >
                  {slot.slot_name}
                  <span className="ml-1 text-[10px] text-stone-400">点击编辑</span>
                </button>
          }
        </div>
        {!slot.is_fixed && (
          <button
            type="button"
            onClick={() => onRemove(slotIdx)}
            className="rounded-lg p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Song list */}
      {slot.songs.length > 0 && (
        <div className="space-y-2">
          {slot.songs.map((song, songIdx) => (
            <div key={songIdx} className="flex items-start gap-2">
              <GripVertical className="h-4 w-4 text-stone-300 mt-3 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <input
                  value={song.title}
                  onChange={e => onUpdateSong(slotIdx, songIdx, 'title', e.target.value)}
                  placeholder="曲目名称"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2
                             text-sm text-stone-800 placeholder:text-stone-400
                             focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                />
                <div className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  <input
                    value={song.url}
                    onChange={e => onUpdateSong(slotIdx, songIdx, 'url', e.target.value)}
                    placeholder="链接（YouTube、网易云、Spotify…）"
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2
                               text-xs text-stone-600 placeholder:text-stone-400
                               focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveSong(slotIdx, songIdx)}
                    className="rounded-lg p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add song */}
      <button
        type="button"
        onClick={() => onAddSong(slotIdx)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300
                   bg-white px-3 py-2 text-xs text-stone-500
                   hover:border-indigo-300 hover:text-indigo-600 transition-colors w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        添加曲目
      </button>
    </div>
  )
}
