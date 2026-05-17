'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Wheat } from 'lucide-react'

const ERROR_MAP: Record<string, string> = {
  missing_code:             '请输入 6 位邀请码',
  invalid_code:             '邀请码无效，请向组长确认',
  already_member:           '你已是团契成员，无需重复加入',
  fellowship_not_approved:  '该团契尚未通过审批',
  join_failed:              '加入失败，请稍后重试',
}

export default function FellowshipJoinPage() {
  const router = useRouter()
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length < 4) { setError('请输入正确的邀请码'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/fellowship/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invite_code: code.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(ERROR_MAP[data.error] ?? '加入失败，请重试')
        return
      }

      setSuccess(data.fellowship_name ?? '麦穗团契')
      setTimeout(() => router.push('/fellowship'), 1800)
    } catch {
      setError('网络异常，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3.5">
          <Link
            href="/fellowship"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-stone-500
                       hover:bg-stone-100 hover:text-stone-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium">返回</span>
          </Link>
          <div className="flex flex-1 items-center justify-center gap-2">
            <Wheat className="h-4 w-4 text-amber-500" />
            <h1 className="text-sm font-bold text-stone-900">加入麦穗团契</h1>
          </div>
          <div className="w-14" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-10 pb-32">

        {success ? (
          /* ── 成功状态 ──────────────────────────── */
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full
                            bg-gradient-to-br from-amber-100 to-orange-100 text-3xl shadow-sm">
              🌾
            </div>
            <div>
              <p className="text-base font-bold text-stone-900 tracking-wide">
                已成功加入「{success}」
              </p>
              <p className="mt-1 text-sm text-stone-500">正在跳转到团契页面…</p>
            </div>
          </div>
        ) : (
          /* ── 输入表单 ──────────────────────────── */
          <div className="rounded-2xl border border-stone-100 bg-white/90 p-6
                          shadow-md shadow-amber-900/5 backdrop-blur-md">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full
                              bg-amber-50 text-2xl">
                👥
              </div>
              <p className="text-base font-bold text-stone-900">输入 6 位邀请码</p>
              <p className="text-sm text-stone-500 leading-snug">
                向你的真实团契组长索取邀请码，即可加入守望小组。
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="例：ABC123"
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/80
                           px-4 py-4 text-center text-2xl font-mono font-bold tracking-[0.35em]
                           text-stone-900 placeholder:text-stone-300 placeholder:text-lg
                           focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300
                           transition-all"
              />

              {error && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5
                              text-sm font-medium text-red-600 text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 4}
                className="flex w-full items-center justify-center rounded-xl
                           bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                           py-3.5 text-sm font-bold tracking-wide text-white
                           shadow-md shadow-amber-500/20
                           hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />加入中…</>
                  : '加入团契'
                }
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-stone-400 leading-relaxed">
              麦穗团契为私密守望小组，仅受邀成员可加入。
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
