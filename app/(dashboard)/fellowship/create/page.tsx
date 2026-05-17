'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Users, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function CreateFellowshipPage() {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [addr,    setAddr]    = useState('')
  const [contact, setContact] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const canSubmit = name.trim().length >= 2 && !busy

  async function handleSubmit() {
    if (!canSubmit) return
    setBusy(true); setError(null)

    try {
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) { router.push('/login'); return }

      // Member creates fellowship as 'pending' — church_admin must approve
      const { data: fellowship, error: fErr } = await supabase
        .from('fellowships')
        .insert({
          name:            name.trim(),
          leader_id:       user.id,
          status:          'pending',
          meeting_address: addr.trim()    || null,
          leader_contact:  contact.trim() || null,
        })
        .select('id')
        .single()

      if (fErr || !fellowship) throw new Error(fErr?.message ?? '提交失败')

      // Add proposer as first member
      await supabase
        .from('fellowship_members')
        .insert({ fellowship_id: fellowship.id, user_id: user.id, layer2_label: '守望者' })

      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 text-4xl shadow-md">
          🌾
        </div>
        <div>
          <p className="text-lg font-black text-stone-900 tracking-wide">申请已提交</p>
          <p className="mt-2 text-sm text-stone-500 leading-relaxed max-w-[260px]">
            你的团契申请正在等待教会管理员审核。审核批准后，团契将正式开放。
          </p>
        </div>
        <Link
          href="/fellowship"
          className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                     px-8 py-3 text-sm font-bold text-white tracking-wide
                     shadow-md shadow-amber-500/20 transition-all hover:opacity-90 active:scale-[0.98]"
        >
          返回团契页
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3.5">
          <Link href="/fellowship"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-stone-500 hover:bg-stone-100 transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium">返回</span>
          </Link>
          <div className="flex flex-1 items-center justify-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            <h1 className="text-sm font-bold text-stone-900">申请创建麦穗小组</h1>
          </div>
          <span className="w-14" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-8 pb-32">

        {/* Notice */}
        <div className="mb-6 rounded-2xl border border-amber-100/60 bg-gradient-to-br from-amber-50/70 to-orange-50/50 px-5 py-5">
          <p className="text-sm text-stone-700 leading-relaxed">
            🌾 提交后，你的申请将进入教会管理员的审核队列。批准后系统将自动为小组生成
            <strong> 6 位专属邀请码</strong>，你即成为守望组长。
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">

          {/* Name */}
          <div className="px-5 pt-5 pb-4 border-b border-stone-50">
            <label className="text-sm font-semibold text-stone-700 block mb-2">
              小组名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="例如：恩典团契、周五查经小组…"
              maxLength={30}
              disabled={busy}
              className="w-full rounded-xl border border-stone-200/60 bg-stone-50/90
                         px-4 py-3 text-stone-700 placeholder:text-stone-400
                         focus:border-amber-400 focus:ring-1 focus:ring-amber-400
                         focus:outline-none disabled:opacity-60 text-sm"
            />
            <p className="mt-1.5 text-xs text-stone-400 text-right">{name.length} / 30</p>
          </div>

          {/* Address */}
          <div className="px-5 pt-4 pb-4 border-b border-stone-50">
            <label className="text-sm font-semibold text-stone-700 flex items-center gap-1.5 mb-2">
              <MapPin className="h-3.5 w-3.5 text-stone-400" />
              聚会地址
              <span className="text-xs font-normal text-stone-400">（可选）</span>
            </label>
            <input
              type="text"
              value={addr}
              onChange={e => setAddr(e.target.value)}
              placeholder="例如：恩典教会 B101 室"
              maxLength={80}
              disabled={busy}
              className="w-full rounded-xl border border-stone-200/60 bg-stone-50/90
                         px-4 py-3 text-stone-700 placeholder:text-stone-400
                         focus:border-amber-400 focus:ring-1 focus:ring-amber-400
                         focus:outline-none disabled:opacity-60 text-sm"
            />
          </div>

          {/* Contact */}
          <div className="px-5 pt-4 pb-4 border-b border-stone-50">
            <label className="text-sm font-semibold text-stone-700 flex items-center gap-1.5 mb-2">
              <Phone className="h-3.5 w-3.5 text-stone-400" />
              组长联系方式
              <span className="text-xs font-normal text-stone-400">（可选）</span>
            </label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="例如：微信号 / 手机号"
              maxLength={60}
              disabled={busy}
              className="w-full rounded-xl border border-stone-200/60 bg-stone-50/90
                         px-4 py-3 text-stone-700 placeholder:text-stone-400
                         focus:border-amber-400 focus:ring-1 focus:ring-amber-400
                         focus:outline-none disabled:opacity-60 text-sm"
            />
          </div>

          {error && (
            <div className="px-5 py-3 border-b border-red-50 bg-red-50/80">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'w-full block py-5 px-6 text-xl font-black tracking-widest text-center',
              'transition-all duration-300 active:scale-[0.99] focus:outline-none',
              canSubmit
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20 cursor-pointer'
                : 'bg-stone-50 text-stone-300 cursor-not-allowed',
            ].join(' ')}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2 text-base font-bold">
                <Loader2 className="h-5 w-5 animate-spin" />提交申请中…
              </span>
            ) : '🌾 提交审核申请'}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400 leading-relaxed">
          申请提交后需教会管理员批准，审核结果将在设置中心反映。
        </p>
      </main>
    </div>
  )
}
