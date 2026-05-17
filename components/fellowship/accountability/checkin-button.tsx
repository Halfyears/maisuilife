'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'

type CheckinStatus = 'done' | 'missed' | 'postponed'

interface CheckinButtonProps {
  fellowshipId:  string
  today:         string
  currentStatus: CheckinStatus | null
  currentNote:   string | null
}

const STATUS_OPTIONS: { value: CheckinStatus; icon: string; label: string; active: string; inactive: string }[] = [
  {
    value:    'done',
    icon:     '✓',
    label:    '完成',
    active:   'bg-green-500 text-white border-green-500',
    inactive: 'border-stone-200 text-stone-500 hover:border-green-300 hover:text-green-600 hover:bg-green-50',
  },
  {
    value:    'missed',
    icon:     '✗',
    label:    '未完成',
    active:   'bg-red-500 text-white border-red-500',
    inactive: 'border-stone-200 text-stone-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50',
  },
  {
    value:    'postponed',
    icon:     '⏳',
    label:    '延期',
    active:   'bg-amber-500 text-white border-amber-500',
    inactive: 'border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50',
  },
]

export function CheckinButton({ fellowshipId, today, currentStatus, currentNote }: CheckinButtonProps) {
  const router  = useRouter()
  const [open,   setOpen]   = useState(false)
  const [status, setStatus] = useState<CheckinStatus>(currentStatus ?? 'done')
  const [note,   setNote]   = useState(currentNote ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/fellowship/accountability/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fellowship_id: fellowshipId,
          checkin_date:  today,
          status,
          note: note.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setOpen(false)
      router.refresh()
    } catch {
      setError('提交失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const buttonLabel = currentStatus
    ? '修改今日打卡'
    : '完成今日打卡'

  return (
    <>
      <button
        onClick={() => { setOpen(true); setStatus(currentStatus ?? 'done'); setNote(currentNote ?? ''); setError(null) }}
        className={[
          'w-full rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.99]',
          currentStatus === 'done'
            ? 'bg-green-500 text-white hover:bg-green-600'
            : currentStatus
              ? 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20 hover:opacity-90',
        ].join(' ')}
      >
        {buttonLabel}
      </button>

      {/* ── Modal overlay ───────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-stone-900 mb-1.5">今日打卡</h3>
            <p className="text-xs text-stone-400 mb-5">{today}</p>

            {/* Status selection */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={[
                    'flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3.5 text-xs font-bold transition-all',
                    status === opt.value ? opt.active : opt.inactive,
                  ].join(' ')}
                >
                  <span className="text-lg leading-none">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Note input */}
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="添加备注（可选）…"
              maxLength={500}
              rows={3}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3
                         text-sm text-stone-700 placeholder-stone-300
                         focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent
                         resize-none mb-4"
            />

            {error && (
              <p className="text-xs text-red-600 mb-3 text-center">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-stone-200 py-3 text-sm font-medium text-stone-500
                           hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl
                           bg-gradient-to-r from-amber-500 to-orange-500
                           py-3 text-sm font-bold text-white
                           shadow-md shadow-orange-500/20 hover:opacity-90
                           disabled:opacity-60 transition-opacity"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" />提交中…</>
                  : '确认打卡'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
