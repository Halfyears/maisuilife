'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

type SubState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function PushSubscribeButton() {
  const [state, setState] = useState<SubState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setState('subscribed')
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setState('subscribed')
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
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null
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
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-stone-50
                   px-4 py-3 text-sm font-medium text-stone-500
                   hover:bg-stone-100 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        <BellOff className="h-4 w-4 shrink-0 text-stone-400" />
        <div className="text-left">
          <p className="font-semibold text-stone-700">灵命推送通知已开启</p>
          <p className="text-xs text-stone-400">每周日 9:00 · 每月初 9:30 · 点击关闭</p>
        </div>
      </button>
    )
  }

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
        <p className="text-xs text-amber-600/70">每周日 9:00 主日报告 · 每月初 9:30 月度报告</p>
      </div>
    </button>
  )
}
