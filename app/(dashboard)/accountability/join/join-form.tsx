'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Target } from 'lucide-react'

const ERROR_MAP: Record<string, string> = {
  code_required:  '请输入邀请码',
  invalid_code:   '邀请码无效，请确认后重试',
  already_member: '你已经是该小组成员',
  group_full:     '小组已满（最多 12 人），请联系召集人',
  unauthorized:   '请先登录',
}

function JoinForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const presetCode  = (searchParams.get('code') ?? '').toUpperCase().slice(0, 6)

  const [code,    setCode]    = useState(presetCode)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const autoSubmitted = useRef(false)

  async function submit(codeToSubmit?: string) {
    const trimmed = (codeToSubmit ?? code).trim().toUpperCase()
    if (trimmed.length !== 6) { setError('请输入 6 位邀请码'); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/accountability/groups/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invite_code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(ERROR_MAP[data.error] ?? '加入失败，请重试')
        return
      }
      setSuccess(data.group_name)
      setTimeout(() => router.push(`/accountability/${data.group_id}`), 1500)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (presetCode.length === 6 && !autoSubmitted.current) {
      autoSubmitted.current = true
      submit(presetCode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">加入同行小组</h1>
          <Link
            href="/accountability"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-10 pb-20">
        {success ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="text-5xl">🎉</div>
            <p className="text-base font-bold text-stone-900">成功加入「{success}」</p>
            <p className="text-sm text-stone-500">正在跳转…</p>
          </div>
        ) : loading && presetCode.length === 6 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-stone-500">正在加入小组…</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); submit() }} className="space-y-6">
            <div className="text-center">
              <p className="text-base font-bold text-stone-900 mb-1">输入 6 位邀请码</p>
              <p className="text-xs text-stone-500">向小组召集人获取邀请码</p>
            </div>

            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full text-center text-3xl font-black tracking-[0.4em]
                         rounded-2xl border-2 border-stone-200 bg-white py-5
                         text-stone-900 placeholder-stone-200
                         focus:outline-none focus:border-amber-400
                         transition-colors"
              autoFocus={!presetCode}
              autoCapitalize="characters"
              autoComplete="off"
            />

            {error && <p className="text-center text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 rounded-2xl
                         bg-gradient-to-r from-amber-500 to-orange-500
                         py-3.5 text-sm font-bold text-white
                         shadow-md shadow-orange-500/20 hover:opacity-90
                         disabled:opacity-50 transition-opacity"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />加入中…</> : '加入小组'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

export function AccountabilityJoinFormPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    }>
      <JoinForm />
    </Suspense>
  )
}
