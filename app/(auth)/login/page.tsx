'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wheat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Mode = 'password' | 'magic'
type Step = 'form' | 'magic_sent' | 'admin_prompt'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') ?? '/daily'
  const supabase     = createClient()

  const [mode, setMode]         = useState<Mode>('password')
  const [step, setStep]         = useState<Step>('form')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr
      const { data: profile } = await supabase
        .from('users').select('role').eq('id', data.user!.id).single()
      if (profile?.role === 'super_admin') { setStep('admin_prompt') }
      else { router.push(redirectTo) }
    } catch {
      setError('邮箱或密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
      })
      if (otpErr) throw otpErr
      setStep('magic_sent')
    } catch {
      setError('发送失败，请检查邮箱地址')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'admin_prompt') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <Wheat className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-base font-bold text-stone-900 tracking-wide">欢迎回来，管理员</p>
            <p className="mt-1 text-sm font-medium text-stone-500">请选择进入的页面</p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => router.push('/admin/hub')}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3
                         text-sm font-bold text-white shadow-md shadow-amber-500/20
                         transition-all hover:opacity-90 active:scale-[0.98]"
            >
              进入管理中枢
            </button>
            <button
              onClick={() => router.push('/daily')}
              className="w-full rounded-xl border border-stone-200 py-3 text-sm font-medium
                         text-stone-600 hover:bg-stone-50 transition-colors"
            >
              进入今日内室
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  if (step === 'magic_sent') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl">✉</div>
          <p className="text-base font-bold text-stone-900 tracking-wide">魔术链接已发送</p>
          <p className="text-sm font-medium text-stone-500 leading-relaxed">
            请查收 <strong className="text-stone-700">{email}</strong> 的邮件，
            点击链接完成登录。
          </p>
          <button type="button" onClick={() => setStep('form')}
            className="text-sm text-stone-400 underline underline-offset-2 hover:text-stone-600">
            返回
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {/* Brand */}
      <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <Wheat className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-wide">麦穗喜乐</h1>
        <p className="text-sm font-medium text-stone-500">属灵陪伴，同行成长</p>
      </div>

      {/* Mode toggle */}
      <div className="mb-5 flex rounded-xl border border-stone-200 bg-stone-50/80 p-1">
        {(['password', 'magic'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null) }}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600',
            )}
          >
            {m === 'password' ? '密码登录' : '魔术链接'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="email">邮箱</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm
                       text-stone-900 placeholder:text-stone-300 transition-all
                       focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
          />
        </div>

        {mode === 'password' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="pw">密码</label>
            <input
              id="pw" type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm
                         text-stone-900 transition-all
                         focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
            />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                     py-3 text-sm font-bold tracking-wide text-white
                     shadow-md shadow-amber-500/20 transition-all
                     hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? '处理中…' : mode === 'password' ? '登 录' : '发送魔术链接'}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-1 text-xs text-stone-400">
        <span>还没有账号？</span>
        <Link href="/register"
          className="font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700">
          立即注册
        </Link>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-stone-100/85 bg-white/90 p-8
                      shadow-sm backdrop-blur-md">
        {children}
      </div>
    </div>
  )
}
