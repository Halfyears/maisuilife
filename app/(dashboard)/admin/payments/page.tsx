'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'

interface Proof {
  id: string
  user_id: string
  channel: string
  amount: number
  currency: string
  user_memo: string | null
  status: string
  admin_note: string | null
  created_at: string
}

const CHANNEL_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  zelle:      { label: 'Zelle',    icon: '💜', color: 'text-purple-700 bg-purple-50' },
  venmo:      { label: 'Venmo',    icon: '💙', color: 'text-blue-700 bg-blue-50'   },
  paypal:     { label: 'PayPal',   icon: '🔵', color: 'text-indigo-700 bg-indigo-50' },
  wechat_pay: { label: '微信支付', icon: '💚', color: 'text-green-700 bg-green-50'  },
  alipay:     { label: '支付宝',   icon: '🔷', color: 'text-sky-700 bg-sky-50'     },
}

const STATUS_TAB = [
  { key: 'pending_review', label: '待审核' },
  { key: 'approved',       label: '已确认' },
  { key: 'rejected',       label: '已驳回' },
]

export default function AdminPaymentsPage() {
  const [tab,     setTab]     = useState('pending_review')
  const [proofs,  setProofs]  = useState<Proof[]>([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState<string | null>(null)
  const [note,    setNote]    = useState<Record<string, string>>({})

  const load = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/payments?status=${status}`)
      const d = await r.json()
      setProofs(d.proofs ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  async function act(id: string, action: 'approved' | 'rejected') {
    setActing(id)
    try {
      await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note: note[id] ?? null }),
      })
      setProofs(p => p.filter(x => x.id !== id))
    } finally { setActing(null) }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3.5">
          <Link href="/admin/hub"
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors">
            <ChevronLeft className="h-4 w-4" />后台
          </Link>
          <h1 className="text-sm font-bold text-stone-900">奉献凭证审核</h1>
          <button onClick={() => load(tab)}
            className="ml-auto flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5
                       text-xs text-stone-500 hover:bg-stone-100 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />刷新
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-20">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 rounded-xl border border-stone-100 bg-white p-1 shadow-sm">
          {STATUS_TAB.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={[
                'flex-1 rounded-lg py-2 text-xs font-semibold transition-colors',
                tab === t.key ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100',
              ].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        )}

        {!loading && proofs.length === 0 && (
          <div className="py-12 text-center text-sm text-stone-400">暂无记录</div>
        )}

        <div className="space-y-3">
          {proofs.map(p => {
            const ch = CHANNEL_LABEL[p.channel] ?? { label: p.channel, icon: '💳', color: 'text-stone-700 bg-stone-100' }
            const date = new Date(p.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={p.id}
                className="rounded-2xl border border-stone-100 bg-white px-5 py-4 shadow-sm space-y-3">

                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${ch.color}`}>
                      {ch.icon} {ch.label}
                    </span>
                    <span className="text-base font-black text-stone-900">
                      {p.currency} {p.amount.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-400">{date}</span>
                </div>

                {/* User memo */}
                {p.user_memo && (
                  <p className="text-xs text-stone-600 bg-stone-50 rounded-lg px-3 py-2">
                    {p.user_memo}
                  </p>
                )}

                {/* Admin note (for reviewed) */}
                {p.admin_note && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    备注：{p.admin_note}
                  </p>
                )}

                {/* Actions for pending */}
                {tab === 'pending_review' && (
                  <div className="space-y-2 pt-1">
                    <input
                      value={note[p.id] ?? ''}
                      onChange={e => setNote(n => ({ ...n, [p.id]: e.target.value }))}
                      placeholder="驳回原因（选填）"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs
                                 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                    />
                    <div className="flex gap-2">
                      {acting === p.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                        : <>
                            <button onClick={() => act(p.id, 'approved')}
                              className="flex items-center gap-1.5 rounded-xl bg-green-500 px-4 py-2
                                         text-xs font-bold text-white hover:bg-green-600 transition-colors">
                              <CheckCircle className="h-3.5 w-3.5" />确认到账
                            </button>
                            <button onClick={() => act(p.id, 'rejected')}
                              className="flex items-center gap-1.5 rounded-xl border border-red-200
                                         bg-red-50 px-4 py-2 text-xs font-bold text-red-600
                                         hover:bg-red-100 transition-colors">
                              <XCircle className="h-3.5 w-3.5" />驳回
                            </button>
                          </>
                      }
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
