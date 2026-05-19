'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, Church, Users, Target, Pencil, X, Check, Loader2, ChevronRight } from 'lucide-react'

interface ProfileCardProps {
  initialName: string
  email:       string
  badge:       { label: string; className: string }
  joinedYear:  number | null
  churchName:  string | null
  fellowship:  string | null
  acctGroups:  { id: string; name: string }[]
}

export function ProfileCard({
  initialName, email, badge, joinedYear,
  churchName, fellowship, acctGroups,
}: ProfileCardProps) {
  const router = useRouter()
  const [name,      setName]      = useState(initialName)
  const [editing,   setEditing]   = useState(false)
  const [draft,     setDraft]     = useState(initialName)
  const [error,     setError]     = useState('')
  const [isPending, startTransition] = useTransition()

  function startEdit()  { setDraft(name); setError(''); setEditing(true)  }
  function cancelEdit() { setEditing(false); setError('') }

  function handleSave() {
    if (!draft.trim()) { setError('姓名不能为空'); return }
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/user/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ display_name: draft.trim() }),
      })
      if (!res.ok) { setError('保存失败，请稍后再试'); return }
      setName(draft.trim())
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">

      {/* ── 头像 + 名字 + 角色徽标 ── */}
      <div className="flex items-center gap-4 px-5 py-5 border-b border-stone-100">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full
                        bg-gradient-to-br from-amber-100 to-orange-100 text-2xl font-bold text-stone-700">
          {name.slice(0, 1) || '?'}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={30}
              autoFocus
              className="w-full rounded-xl border border-amber-300 bg-amber-50/50 px-3 py-1.5
                         text-base font-bold text-stone-900
                         focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
            />
          ) : (
            <p className="text-base font-bold text-stone-900">{name || '—'}</p>
          )}
          <p className="text-xs font-medium text-stone-400 truncate mt-0.5">{email}</p>
          <span className={`${badge.className} mt-1.5 inline-block`}>{badge.label}</span>
          {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
        </div>

        <div className="flex items-center shrink-0">
          {editing ? (
            <>
              <button type="button" onClick={handleSave} disabled={isPending}
                className="flex items-center justify-center h-8 w-8 rounded-xl bg-amber-500 text-white
                           hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={cancelEdit}
                className="flex items-center justify-center h-8 w-8 rounded-xl border border-stone-200
                           text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors ml-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button type="button" onClick={startEdit}
              className="flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50
                         px-2.5 py-1.5 text-[11px] text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
              <Pencil className="h-3 w-3" />编辑
            </button>
          )}
        </div>
      </div>

      {/* ── 信息行 ── */}

      {/* 加入年份 — 不可点击 */}
      <InfoRow icon={<LogIn className="h-4 w-4 text-stone-300" />} label="加入年份">
        <span className="text-sm font-medium text-stone-700">
          {joinedYear ? `自 ${joinedYear} 年起` : '—'}
        </span>
      </InfoRow>

      {/* 所属教会 — 不可点击（暂无用户侧教会专属页） */}
      <InfoRow icon={<Church className="h-4 w-4 text-stone-300" />} label="教会">
        <span className="text-sm font-medium text-stone-700">
          {churchName ?? '—'}
        </span>
      </InfoRow>

      {/* 所属团契 — 可点击 */}
      <InfoRow icon={<Users className="h-4 w-4 text-stone-300" />} label="团契">
        {fellowship ? (
          <Link href="/fellowship"
            className="flex items-center gap-1 text-sm font-medium text-amber-700
                       hover:text-amber-800 transition-colors">
            {fellowship}
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </Link>
        ) : (
          <Link href="/fellowship"
            className="flex items-center gap-1 text-sm font-medium text-stone-400
                       hover:text-amber-600 transition-colors">
            暂未加入
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          </Link>
        )}
      </InfoRow>

      {/* 所属同行 — 可点击 */}
      <InfoRow icon={<Target className="h-4 w-4 text-stone-300" />} label="同行小组">
        {acctGroups.length > 0 ? (
          <div className="flex flex-col gap-1">
            {acctGroups.map(g => (
              <Link key={g.id} href={`/accountability/${g.id}`}
                className="flex items-center gap-1 text-sm font-medium text-amber-700
                           hover:text-amber-800 transition-colors">
                {g.name}
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </Link>
            ))}
          </div>
        ) : (
          <Link href="/accountability"
            className="flex items-center gap-1 text-sm font-medium text-stone-400
                       hover:text-amber-600 transition-colors">
            暂未加入
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          </Link>
        )}
      </InfoRow>

    </div>
  )
}

function InfoRow({ icon, label, children }: {
  icon:     React.ReactNode
  label:    string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50 last:border-0">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs font-medium text-stone-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
