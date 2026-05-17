'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Users } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function CreateFellowshipPage() {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const canCreate = name.trim().length >= 2 && !busy

  async function handleCreate() {
    if (!canCreate) return
    setBusy(true)
    setError(null)

    try {
      const supabase = createClient()

      // 浏览器客户端持有用户 session cookie，auth.uid() 能正确解析
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        router.push('/login')
        return
      }

      // 1. 创建团契 — INSERT 策略 `leader_id = auth.uid()` 现可通过
      const { data: fellowship, error: fErr } = await supabase
        .from('fellowships')
        .insert({ name: name.trim(), leader_id: user.id })
        .select('id')
        .single()

      if (fErr || !fellowship) {
        throw new Error(fErr?.message ?? '创建团契失败，请重试')
      }

      // 2. 将创建者加为成员（leader 身份）
      const { error: mErr } = await supabase
        .from('fellowship_members')
        .insert({
          fellowship_id: fellowship.id,
          user_id:       user.id,
          layer2_label:  '守望者',
        })
      if (mErr) throw new Error(mErr.message)

      // 3. 若当前角色为普通成员，升级为 leader
      await supabase
        .from('users')
        .update({ role: 'leader' })
        .eq('id', user.id)
        .eq('role', 'user')

      router.push('/fellowship')
      router.refresh()

    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败，请重试')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3.5">
          <Link href="/fellowship"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-stone-500
                       hover:bg-stone-100 transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium">返回</span>
          </Link>
          <div className="flex flex-1 items-center justify-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            <h1 className="text-sm font-bold text-stone-900">创建新麦穗小组</h1>
          </div>
          <span className="w-14" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-8 pb-32">

        {/* 说明卡 */}
        <div className="mb-6 rounded-2xl border border-amber-100/60 bg-gradient-to-br
                        from-amber-50/70 to-orange-50/50 px-5 py-5">
          <p className="text-sm text-stone-700 leading-relaxed">
            🌾 你即将成为这个麦穗小组的守望组长。系统会自动为你生成
            <strong> 6 位专属邀请码</strong>，分享给弟兄姐妹加入你的属灵同行圈。
          </p>
        </div>

        {/* 创建卡 */}
        <div className="rounded-2xl border border-stone-100 bg-white/90
                        shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">

          <div className="px-5 pt-5 pb-4 border-b border-stone-50">
            <label className="text-sm font-semibold text-stone-700 block mb-2">
              小组名称
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
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

          {error && (
            <div className="px-5 py-3 border-b border-red-50 bg-red-50/80">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className={[
              'w-full block py-5 px-6 text-xl font-black tracking-widest text-center',
              'transition-all duration-300 active:scale-[0.99] focus:outline-none',
              canCreate
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20 cursor-pointer'
                : 'bg-stone-50 text-stone-300 cursor-not-allowed',
            ].join(' ')}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2 text-base font-bold">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在创建…
              </span>
            ) : (
              '🌾 立即创建'
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400 leading-relaxed">
          ✨ 开启属于你们的属灵同行之旅，在生命的话语中建立风雨同舟的守望关系。
        </p>
      </main>
    </div>
  )
}
