'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

type SubState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

interface NotifPrefs {
  morning:  boolean
  checkin:  boolean
  vigil:    boolean
  sunday:   boolean
  monthly:  boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  morning: true, checkin: true, vigil: true, sunday: true, monthly: true,
}

const NOTIF_ITEMS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: 'morning',  label: '晨间内室',  desc: '每日灵修提醒'         },
  { key: 'checkin',  label: '同行打卡',  desc: '小组打卡提醒'         },
  { key: 'vigil',    label: '守望消息',  desc: '有人守望时通知'       },
  { key: 'sunday',   label: '主日报告',  desc: '每周主日聚会摘要'     },
  { key: 'monthly',  label: '月度报告',  desc: '每月灵命成长总结'     },
]

export function PushSubscribeButton() {
  const [state,     setState]     = useState<SubState>('loading')
  const [busy,      setBusy]      = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [prefs,     setPrefs]     = useState<NotifPrefs>(DEFAULT_PREFS)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setState('subscribed')
        // Load saved prefs
        fetch('/api/user/notification-prefs')
          .then(r => r.json())
          .then(data => {
            if (data.prefs && typeof data.prefs === 'object') {
              setPrefs({ ...DEFAULT_PREFS, ...data.prefs })
            }
          })
          .catch(() => {})
      } else if (Notification.permission === 'denied') {
        setState('denied')
      } else {
        setState('unsubscribed')
      }
    }).catch(() => setState('unsupported'))
  }, [])

  async function subscribe() {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
        ) as BufferSource,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      await fetch('/api/user/notification-prefs', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: DEFAULT_PREFS }),
      })
      setPrefs(DEFAULT_PREFS)
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
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
      setExpanded(false)
    } finally {
      setBusy(false)
    }
  }

  async function togglePref(key: keyof NotifPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    setSavingKey(key)
    try {
      await fetch('/api/user/notification-prefs', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: updated }),
      })
    } catch {
      setPrefs(prefs) // revert on error
    } finally {
      setSavingKey(null)
    }
  }

  if (state === 'loading')     return null
  if (state === 'unsupported') return null

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 text-xs text-stone-400">
        <BellOff className="h-4 w-4 shrink-0" />
        通知已被浏览器屏蔽，请在浏览器设置中允许后刷新
      </div>
    )
  }

  if (state === 'subscribed') {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Bell className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-700">灵命推送通知已开启</p>
            <p className="text-xs text-stone-400">
              {Object.values(prefs).filter(Boolean).length} / {NOTIF_ITEMS.length} 项已激活
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

        {/* Expanded prefs panel */}
        {expanded && (
          <div className="border-t border-stone-100 bg-white px-4 py-3 space-y-2">
            {NOTIF_ITEMS.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-700">{item.label}</p>
                  <p className="text-[11px] text-stone-400">{item.desc}</p>
                </div>
                <button
                  onClick={() => togglePref(item.key)}
                  disabled={savingKey === item.key}
                  className={[
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors duration-200',
                    prefs[item.key]
                      ? 'bg-amber-400 border-amber-400'
                      : 'bg-stone-200 border-stone-200',
                    savingKey === item.key ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <span className={[
                    'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    prefs[item.key] ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')} />
                </button>
              </div>
            ))}
            <button
              onClick={unsubscribe}
              disabled={busy}
              className="w-full mt-3 rounded-lg border border-stone-200 py-2 text-xs
                         text-stone-400 hover:bg-stone-50 hover:text-red-500 transition-colors"
            >
              关闭所有推送
            </button>
          </div>
        )}
      </div>
    )
  }

  // unsubscribed state
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      className="flex w-full items-center gap-2 rounded-xl border border-amber-200
                 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3
                 text-sm font-medium text-amber-700
                 hover:from-amber-100 hover:to-orange-100 active:scale-[0.98] transition-all disabled:opacity-50"
    >
      <Bell className="h-4 w-4 shrink-0 text-amber-500" />
      <div className="text-left">
        <p className="font-semibold">开启灵命成长推送</p>
        <p className="text-xs text-amber-600/70">
          晨间内室 · 同行打卡 · 守望消息 · 主日报告 · 月度报告
        </p>
      </div>
    </button>
  )
}
