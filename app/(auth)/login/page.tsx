'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wheat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Mode = 'password' | 'magic'
type Step = 'form' | 'magic_sent' | 'admin_prompt'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/daily'
  const supabase     = createClient()

  const [mode, setMode]       = useState<Mode>('password')
  const [step, setStep]       = useState<Step>('form')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      // Check role for admin prompt
      const { data: profile } = await supabase
        .from('users').select('role').eq('id', data.user!.id).single()

      if (profile?.role === 'super_admin') {
        setStep('admin_prompt')
      } else {
        router.push(redirect)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? '邮箱或密码错误，请重试' : '登录失败')
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
        options: { emailRedirectTo: `${window.location.origin}${redirect}` },
      })
      if (otpErr) throw otpErr
      setStep('magic_sent')
    } catch {
      setError('发送失败，请检查邮箱地址')
    } finally {
      setLoading(false)
    }
  }

  // ── Admin prompt: super_admin logged in, offer hub redirect ────
  if (step === 'admin_prompt') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/15">
            <Wheat className="h-6 w-6 text-gold-600" />
          </div>
          <div>
            <p className="font-semibold text-foreground">欢迎回来，管理员</p>
            <p className="mt-1 text-sm text-muted-foreground">请选择进入的页面</p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => router.push('/admin/hub')}
              className="w-full rounded-xl bg-gold-400 py-2.5 text-sm font-medium text-gold-900 hover:bg-gold-500 transition-colors"
            >
              进入管理中枢
            </button>
            <button
              onClick={() => router.push('/daily')}
              className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              进入今日内室
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Magic link sent ────────────────────────────────────
  if (step === 'magic_sent') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-2xl">✉</div>
          <p className="font-semibold text-foreground">魔术链接已发送</p>
          <p className="text-sm text-muted-foreground">
            请查收 <strong>{email}</strong> 的邮件，点击其中的链接完成登录。
          </p>
          <button
            type="button"
            onClick={() => setStep('form')}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            返回
          </button>
        </div>
      </Shell>
    )
  }

  // ── Main login form ───────────────────────────────────
  return (
    <Shell>
      {/* Brand */}
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Wheat className="h-8 w-8 text-gold-500" />
        <h1 className="font-serif text-2xl font-bold text-foreground">麦穗喜乐</h1>
        <p className="text-sm text-muted-foreground">属灵陪伴，同行成长</p>
      </div>

      {/* Mode tabs */}
      <div className="mb-5 flex rounded-xl border border-border bg-muted/30 p-1">
        {(['password', 'magic'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm transition-all',
              mode === m
                ? 'bg-card font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'password' ? '密码登录' : '魔术链接'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>

        {mode === 'password' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gold-400 py-2.5 text-sm font-medium text-gold-900 hover:bg-gold-500 transition-colors disabled:opacity-60"
        >
          {loading
            ? '处理中…'
            : mode === 'password' ? '登录' : '发送魔术链接'
          }
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        还没有账号？请联系你的团契组长获取邀请。
      </p>
    </Shell>
  )
}

// ── Shared shell ──────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </div>
  )
}
