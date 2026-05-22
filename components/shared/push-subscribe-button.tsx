'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, BellOff, ChevronDown, ChevronUp, Plus, Trash2, Loader2 } from 'lucide-react'
import { type Freq, type NotifItem, BUILTIN_IDS, DEFAULT_ITEMS, normalizeLegacy } from '@/lib/notification-prefs'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

type SubState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: 'daily',    label: '每日'   },
  { value: 'weekly',   label: '每周'   },
  { value: 'monthly',  label: '每月'   },
  { value: 'realtime', label: '实时'   },
]

function genId() {
  return 'custom_' + Math.random().toString(36).slice(2, 9)
}

export function PushSubscribeButton() {
  const [state,    setState]    = useState<SubState>('loading')
  const [busy,     setBusy]     = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [items,    setItems]    = useState<NotifItem[]>(DEFAULT_ITEMS)
  const [saving,   setSaving]   = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addMode,  setAddMode]  = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up pending save timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setState('subscribed')
        fetch('/api/user/notification-prefs')
          .then(r => r.json())
          .then(data => { if (Array.isArray(data.items)) setItems(normalizeLegacy(data.items)) })
          .catch(() => {})
      } else if (Notification.permission === 'denied') {
        setState('denied')
      } else {
        setState('unsubscribed')
      }
    }).catch(() => setState('unsupported'))
  }, [])

  // Debounced auto-save (600 ms after last change)
  function scheduleAutoSave(nextItems: NotifItem[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/user/notification-prefs', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ items: nextItems }),
        })
      } catch { /* silent */ } finally {
        setSaving(false)
      }
    }, 600)
  }

  function updateItem(id: string, patch: Partial<NotifItem>) {
    const next = items.map(i => i.id === id ? { ...i, ...patch } : i)
    setItems(next); scheduleAutoSave(next)
  }

  function deleteCustom(id: string) {
    const next = items.filter(i => i.id !== id)
    setItems(next); scheduleAutoSave(next)
  }

  function addCustomItem() {
    const label = addLabel.trim()
    if (!label) return
    const next: NotifItem[] = [
      ...items,
      { id: genId(), label, enabled: true, time: '09:00', freq: 'daily' },
    ]
    setItems(next); scheduleAutoSave(next)
    setAddLabel(''); setAddMode(false)
  }

  async function subscribe() {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
        ) as BufferSource,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify(sub.toJSON()),
      })
      await fetch('/api/user/notification-prefs', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ items: DEFAULT_ITEMS }),
      })
      setItems(DEFAULT_ITEMS)
      setState('subscribed')
      setExpanded(true)
    } catch {
      if (Notification.permission === 'denied') setState('denied')
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed'); setExpanded(false)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 text-xs text-stone-400">
        <BellOff className="h-4 w-4 shrink-0" />
        通知已被浏览器屏蔽，请在浏览器设置中允许后刷新
      </div>
    )
  }

  if (state === 'subscribed') {
    const activeCount = items.filter(i => i.enabled).length
    const customItems = items.filter(i => !BUILTIN_IDS.has(i.id))

    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Bell className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-700">灵命推送通知已开启</p>
            <p className="text-xs text-stone-400">
              {activeCount}/{items.length} 项已激活
              {saving && <span className="ml-1.5 text-stone-300">· 保存中…</span>}
            </p>
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white
                       px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            设置
          </button>
        </div>

        {/* ── Expanded panel ── */}
        {expanded && (
          <div className="border-t border-stone-100 bg-white divide-y divide-stone-50">

            {/* Built-in items */}
            {items.filter(i => BUILTIN_IDS.has(i.id)).map(item => (
              <NotifRow
                key={item.id}
                item={item}
                canDelete={false}
                onToggle={()     => updateItem(item.id, { enabled: !item.enabled })}
                onTimeChange={t  => updateItem(item.id, { time: t })}
                onFreqChange={f  => updateItem(item.id, { freq: f as Freq })}
              />
            ))}

            {/* Custom items */}
            {customItems.map(item => (
              <NotifRow
                key={item.id}
                item={item}
                canDelete={true}
                onToggle={()     => updateItem(item.id, { enabled: !item.enabled })}
                onTimeChange={t  => updateItem(item.id, { time: t })}
                onFreqChange={f  => updateItem(item.id, { freq: f as Freq })}
                onDelete={()     => deleteCustom(item.id)}
              />
            ))}

            {/* Add custom */}
            <div className="px-4 py-3">
              {addMode ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={addLabel}
                    onChange={e => setAddLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomItem() }}
                    maxLength={20}
                    placeholder="提醒名称，如：午间祷告"
                    className="flex-1 rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-1.5
                               text-xs text-stone-700 placeholder-stone-300
                               focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button onClick={addCustomItem}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white
                               hover:bg-amber-600 transition-colors">
                    添加
                  </button>
                  <button onClick={() => { setAddMode(false); setAddLabel('') }}
                    className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs
                               text-stone-400 hover:bg-stone-100 transition-colors">
                    取消
                  </button>
                </div>
              ) : customItems.length < 5 ? (
                <button
                  onClick={() => setAddMode(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600
                             hover:text-amber-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加自定义提醒
                </button>
              ) : (
                <p className="text-xs text-stone-400">已达自定义上限（5条）</p>
              )}
            </div>

            {/* Close all push */}
            <div className="px-4 py-3 bg-stone-50/80">
              <button
                onClick={unsubscribe}
                disabled={busy}
                className="w-full rounded-lg border border-stone-200 py-2 text-xs
                           text-stone-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50
                           disabled:opacity-50 transition-colors"
              >
                {busy
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                  : '关闭所有推送'
                }
              </button>
            </div>

          </div>
        )}
      </div>
    )
  }

  // unsubscribed
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      className="flex w-full items-center gap-2 rounded-xl border border-amber-200
                 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3
                 text-sm font-medium text-amber-700
                 hover:from-amber-100 hover:to-orange-100 active:scale-[0.98]
                 transition-all disabled:opacity-50"
    >
      {busy
        ? <Loader2 className="h-4 w-4 shrink-0 text-amber-500 animate-spin" />
        : <Bell    className="h-4 w-4 shrink-0 text-amber-500" />
      }
      <div className="text-left">
        <p className="font-semibold">开启灵命成长推送</p>
        <p className="text-xs text-amber-600/70">晨间内室 · 同行打卡 · 守望消息 · 主日报告 · 月度报告</p>
      </div>
    </button>
  )
}

// ── Sub-component ─────────────────────────────────────────────────────────
function NotifRow({
  item, canDelete,
  onToggle, onTimeChange, onFreqChange, onDelete,
}: {
  item:         NotifItem
  canDelete:    boolean
  onToggle:     () => void
  onTimeChange: (t: string) => void
  onFreqChange: (f: string) => void
  onDelete?:    () => void
}) {
  return (
    <div className={`px-4 py-3 space-y-2 transition-opacity ${!item.enabled ? 'opacity-50' : ''}`}>

      {/* Row 1: toggle + label + delete */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors duration-200',
            item.enabled ? 'bg-amber-400 border-amber-400' : 'bg-stone-200 border-stone-200',
          ].join(' ')}
          aria-label={item.enabled ? '关闭此提醒' : '开启此提醒'}
        >
          <span className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            item.enabled ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')} />
        </button>

        <p className="flex-1 text-xs font-semibold text-stone-700">{item.label}</p>

        {canDelete && (
          <button
            onClick={onDelete}
            className="rounded p-1 text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            aria-label="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Row 2: time + freq (only when enabled) */}
      {item.enabled && (
        <div className="flex items-center gap-3 pl-11">
          {item.freq !== 'realtime' && (
            <label className="flex items-center gap-1 text-[11px] text-stone-400">
              推送时间
              <input
                type="time"
                value={item.time}
                onChange={e => onTimeChange(e.target.value)}
                className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5
                           text-[11px] text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-300"
              />
            </label>
          )}
          <label className="flex items-center gap-1 text-[11px] text-stone-400">
            频率
            <select
              value={item.freq}
              onChange={e => onFreqChange(e.target.value)}
              className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5
                         text-[11px] text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-300"
            >
              {FREQ_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
