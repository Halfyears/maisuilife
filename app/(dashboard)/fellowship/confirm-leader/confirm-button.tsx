'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle } from 'lucide-react'

export function ConfirmLeaderButton({ token }: { token: string }) {
  const router = useRouter()
  const [state,    setState]    = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function confirm() {
    setState('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/fellowship/confirm-leader', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data.error === 'invalid_token'
          ? '邀请已失效，请联系管理员重新邀请'
          : data.error === 'forbidden'
          ? '此邀请不属于您的账号'
          : '操作失败，请重试'
        setErrorMsg(msg)
        setState('error')
        return
      }
      setState('done')
      setTimeout(() => router.push('/fellowship'), 2000)
    } catch {
      setErrorMsg('网络异常，请检查连接后重试')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        <CheckCircle className="h-10 w-10 text-amber-500" />
        <p className="text-sm font-semibold text-stone-800">您已成为团契组长</p>
        <p className="text-xs text-stone-400">正在跳转到团契页面…</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      {errorMsg && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5
                      text-sm font-medium text-red-600 text-center">
          {errorMsg}
        </p>
      )}
      <button
        onClick={confirm}
        disabled={state === 'loading'}
        className="flex w-full items-center justify-center rounded-2xl
                   bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                   py-3.5 text-sm font-bold text-white
                   shadow-md shadow-amber-500/20
                   hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
      >
        {state === 'loading'
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />确认中…</>
          : '确认担任组长'
        }
      </button>
    </div>
  )
}
