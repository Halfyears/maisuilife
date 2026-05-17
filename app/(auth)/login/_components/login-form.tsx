'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wheat, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Turnstile (Cloudflare) ─────────────────────────────
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

function TurnstileWidget({ onToken }: { onToken: (t: string) => void }) {
  const ref      = useRef<HTMLDivElement>(null)
  const rendered = useRef(false)

  const render = useCallback(() => {
    if (rendered.current || !ref.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = (window as any).turnstile
    if (!ts) return
    ts.render(ref.current, { sitekey: TURNSTILE_SITE_KEY, callback: onToken })
    rendered.current = true
  }, [onToken])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).turnstile) { render(); return }
    const script = document.createElement('script')
    script.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = render
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [render])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={ref} className="mt-2 flex justify-center" />
}

// ── Platform detection ─────────────────────────────────
function useIsApplePlatform() {
  const [isApple, setIsApple] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    const apple =
      /iPhone|iPad|iPod/i.test(ua) ||
      (/Mac/i.test(ua) && /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua))
    setIsApple(apple)
  }, [])
  return isApple
}

// ── Google SVG logo ────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ── Apple SVG logo ─────────────────────────────────────
function AppleIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 814 1000" aria-hidden fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.5-56.8-155.2-127.4C46 387.3 0 237.4 0 200.6c0-56.5 21.8-115.9 62.5-163.9 52.2-61.4 134.8-100.4 214-100.4 81.7 0 157.6 48.9 206.9 48.9 46.9 0 130.2-51.8 225.5-51.8 35.5 0 135.3 3.8 207.8 84.4zm-288-110.4C454.2 165 406.3 110 350.9 110c-5.5 0-11.1.3-16.6.9 1.9-46.5 27.5-92.3 56.2-122.2 32.4-33.4 88.6-59.4 139.9-59.4 4.7 0 9.4.3 14.1.7 2.1 48.6-21.9 98.5-50.3 130.6z"/>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────
type Step = 'form' | 'magic_sent' | 'admin_prompt'

export function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'
  const authError    = searchParams.get('error')
  const supabase     = createClient()
  const isApple      = useIsApplePlatform()

  const [step,           setStep]           = useState<Step>('form')
  const [email,          setEmail]          = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [oauthLoading,   setOauthLoading]   = useState<'google' | 'apple' | null>(null)
  const [magicLoading,   setMagicLoading]   = useState(false)
  const [error,          setError]          = useState<string | null>(
    authError === 'auth_failed' ? '登录失败，请重试' : null
  )
  // Honeypot
  const [website, setWebsite] = useState('')

  // ── OAuth sign-in ──────────────────────────────────
  async function signInWithOAuth(provider: 'google' | 'apple') {
    if (website) return // honeypot triggered
    setOauthLoading(provider); setError(null)
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    // The browser will navigate away; no need to reset loading
  }

  // ── Magic link ─────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (website) { setStep('magic_sent'); return } // honeypot
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('请完成人机验证')
      return
    }
    setMagicLoading(true); setError(null)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken, redirectTo }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data.error === 'turnstile_failed'
          ? '人机验证未通过，请刷新重试'
          : '发送失败，请稍后重试'
        setError(msg)
        return
      }
      setStep('magic_sent')
    } catch {
      setError('网络异常，请检查连接后重试')
    } finally {
      setMagicLoading(false)
    }
  }

  // ── Admin prompt ───────────────────────────────────
  if (step === 'admin_prompt') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl">
            🌾
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
                         hover:opacity-90 active:scale-[0.98] transition-all"
            >
              进入管理中枢
            </button>
            <button
              onClick={() => router.push('/')}
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

  // ── Magic sent ─────────────────────────────────────
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
          <button
            type="button"
            onClick={() => { setStep('form'); setError(null) }}
            className="text-sm text-stone-400 underline underline-offset-2 hover:text-stone-600 transition-colors"
          >
            返回
          </button>
        </div>
      </Shell>
    )
  }

  // ── Main form ──────────────────────────────────────
  return (
    <Shell>
      {/* Logo */}
      <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <Wheat className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-wide">麦穗喜乐</h1>
        <p className="text-sm font-medium text-stone-500">属灵陪伴，同行成长</p>
      </div>

      {/* ── OAuth buttons ──────────────────────────── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signInWithOAuth('google')}
          disabled={!!oauthLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-stone-200
                     bg-white py-3 text-sm font-semibold text-stone-700
                     shadow-sm hover:bg-stone-50 active:scale-[0.98]
                     disabled:opacity-60 transition-all"
        >
          {oauthLoading === 'google'
            ? <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            : <GoogleIcon />
          }
          使用 Google 账号登录
        </button>

        {isApple && (
          <button
            type="button"
            onClick={() => signInWithOAuth('apple')}
            disabled={!!oauthLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl
                       bg-stone-900 py-3 text-sm font-semibold text-white
                       shadow-sm hover:bg-stone-800 active:scale-[0.98]
                       disabled:opacity-60 transition-all"
          >
            {oauthLoading === 'apple'
              ? <Loader2 className="h-5 w-5 animate-spin text-white/60" />
              : <AppleIcon />
            }
            使用 Apple 账号登录
          </button>
        )}
      </div>

      {/* ── Divider ────────────────────────────────── */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-xs text-stone-400 font-medium">或使用邮箱魔术链接</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      {/* ── Magic link form ─────────────────────────── */}
      <form onSubmit={handleMagicLink} className="space-y-4">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm
                     text-stone-900 placeholder:text-stone-300 transition-all
                     focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
        />

        {/* Turnstile (only rendered if NEXT_PUBLIC_TURNSTILE_SITE_KEY is set) */}
        <TurnstileWidget onToken={setTurnstileToken} />

        {/* Honeypot — invisible to real users */}
        <div aria-hidden className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
          <input
            tabIndex={-1} autoComplete="off" type="text" name="website"
            value={website} onChange={e => setWebsite(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5
                        text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={magicLoading || !!oauthLoading}
          className="flex w-full items-center justify-center rounded-xl
                     bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                     py-3 text-sm font-bold tracking-wide text-white
                     shadow-md shadow-amber-500/20
                     hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
        >
          {magicLoading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />发送中…</>
            : '发送魔术链接'}
        </button>
      </form>

      {/* ── Register link ───────────────────────────── */}
      <div className="mt-5 flex items-center justify-center gap-1 text-xs text-stone-400">
        <span>还没有账号？</span>
        <Link
          href="/register"
          className="font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700 transition-colors"
        >
          立即注册
        </Link>
      </div>
    </Shell>
  )
}

// ── Shell: original white card on neutral background ──
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
