'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Wheat, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ERROR_MAP: Record<string, string> = {
  invalid_name:   '姓名至少需要 2 个字符',
  invalid_email:  '请输入有效的邮箱地址',
  weak_password:  '密码至少需要 6 位',
  email_taken:    '该邮箱已注册，请直接登录',
  create_failed:  '注册失败，请稍后再试',
  profile_failed: '账号创建异常，请联系支持',
}

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  // Honeypot — hidden from real users, filled only by bots
  const [website, setWebsite]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name.trim(),
          email:       email.trim(),
          password,
          invite_code: inviteCode.trim() || undefined,
          website,   // honeypot — empty for real users
        }),
      })

      const data = await res.json()

      // Honeypot triggered → API returns { success: true } silently
      if (data.success) {
        // Auto sign-in after successful registration
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          // Registration succeeded but sign-in failed; redirect to login
          router.push('/login?registered=1')
        } else {
          router.push('/')
        }
        return
      }

      setError(ERROR_MAP[data.error] ?? '注册失败，请重试')
    } catch {
      setError('网络异常，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-stone-100/85 bg-white/90 p-8
                      shadow-sm backdrop-blur-md">

        {/* Brand */}
        <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
            <Wheat className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-wide">加入麦穗喜乐</h1>
          <p className="text-sm font-medium text-stone-500">麦穗喜乐 · 平安喜乐</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="name">
              你的名字
            </label>
            <input
              id="name" type="text" required
              value={name} onChange={e => setName(e.target.value)}
              placeholder="例：小明"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm
                         text-stone-900 placeholder:text-stone-300 transition-all
                         focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="reg-email">
              邮箱
            </label>
            <input
              id="reg-email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm
                         text-stone-900 placeholder:text-stone-300 transition-all
                         focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500" htmlFor="reg-pw">
              密码
            </label>
            <div className="relative">
              <input
                id="reg-pw" type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 pr-10 text-sm
                           text-stone-900 transition-all
                           focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Invite code — optional */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-stone-500"
              htmlFor="invite">
              团契邀请码
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-400">
                可选
              </span>
            </label>
            <input
              id="invite" type="text"
              value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="组长提供的 6 位邀请码"
              maxLength={8}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm
                         text-stone-900 placeholder:text-stone-300 font-mono tracking-widest
                         transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300"
            />
            <p className="mt-1 text-[11px] text-stone-400">没有邀请码也可以注册，日后再加入团契。</p>
          </div>

          {/* ── Honeypot field — visually hidden from real users ── */}
          <div aria-hidden className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website" name="website" type="text" tabIndex={-1} autoComplete="off"
              value={website} onChange={e => setWebsite(e.target.value)}
            />
          </div>

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
            {loading ? '正在创建账号…' : '创建账号，开始同行'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-1 text-xs text-stone-400">
          <span>已有账号？</span>
          <Link href="/login"
            className="font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700">
            直接登录
          </Link>
        </div>
      </div>
    </div>
  )
}
