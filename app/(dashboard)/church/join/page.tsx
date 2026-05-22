'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Church, Search, Loader2, CheckCircle2 } from 'lucide-react'

interface ChurchResult {
  id:      string
  name:    string
  city:    string | null
  address: string | null
}

export default function ChurchJoinPage() {
  const router = useRouter()

  const [tab,     setTab]     = useState<'code' | 'search'>('code')
  const [code,    setCode]    = useState('')
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<ChurchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [joining,   setJoining]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [churchName, setChurchName] = useState('')
  const [error,     setError]     = useState<string | null>(null)

  async function joinByCode() {
    const c = code.trim().toUpperCase()
    if (!c) { setError('请输入邀请码'); return }
    setJoining(true); setError(null)
    try {
      const res = await fetch('/api/church/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: c }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = {
          invalid_code:   '邀请码无效，请确认后重试',
          already_member: '你已经是该教会成员',
          code_required:  '请输入邀请码',
        }
        setError(msgs[data.error] ?? '加入失败，请重试')
        return
      }
      setChurchName(data.church_name)
      setDone(true)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setJoining(false)
    }
  }

  async function searchChurches() {
    if (!query.trim()) return
    setSearching(true); setError(null)
    try {
      const res = await fetch(`/api/church/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.churches ?? [])
    } catch {
      setError('搜索失败，请重试')
    } finally {
      setSearching(false)
    }
  }

  async function joinChurch(churchId: string, name: string) {
    setJoining(true); setError(null)
    try {
      // Fetch the church invite code first (admin endpoint or we need a different approach)
      // Since church_members insert requires just church_id, we'll use a direct join endpoint
      const res = await fetch('/api/church/join-by-id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: churchId }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = { already_member: '你已经是该教会成员' }
        setError(msgs[data.error] ?? '加入失败，请重试')
        return
      }
      setChurchName(name); setDone(true)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setJoining(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full
                        bg-gradient-to-br from-violet-100 to-purple-100 text-4xl shadow-md">
          ⛪
        </div>
        <div>
          <p className="text-lg font-black text-stone-900">已加入教会</p>
          <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
            欢迎来到「{churchName}」。<br />
            你可以等待管理员分配至团契，<br />或持有团契邀请码直接加入。
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Link href="/fellowship/join"
            className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500
                       px-6 py-3 text-sm font-bold text-white text-center
                       shadow-md shadow-amber-500/20 hover:opacity-90 active:scale-[0.98]">
            输入团契邀请码加入
          </Link>
          <Link href="/settings"
            className="rounded-2xl border border-stone-200 bg-white
                       px-6 py-3 text-sm font-medium text-stone-600 text-center
                       hover:bg-stone-50 active:scale-[0.98]">
            返回设置
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: '#FBFBF9' }}>
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Church className="h-4 w-4 text-violet-500 shrink-0" />
          <h1 className="text-sm font-bold text-stone-900 flex-1">加入教会</h1>
          <Link href="/settings"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32 space-y-5">

        {/* 说明 */}
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-5 py-4">
          <p className="text-xs text-violet-700 leading-relaxed">
            ⛪ 加入教会后，你可以等待管理员分配至团契，或使用团契邀请码直接加入。
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 rounded-xl bg-stone-100/80 p-1">
          <button type="button" onClick={() => setTab('code')}
            className={['flex-1 rounded-lg py-2 text-xs font-semibold transition-all',
              tab === 'code'
                ? 'bg-white shadow-sm text-stone-900'
                : 'text-stone-500 hover:text-stone-700',
            ].join(' ')}>
            邀请码加入
          </button>
          <button type="button" onClick={() => setTab('search')}
            className={['flex-1 rounded-lg py-2 text-xs font-semibold transition-all',
              tab === 'search'
                ? 'bg-white shadow-sm text-stone-900'
                : 'text-stone-500 hover:text-stone-700',
            ].join(' ')}>
            搜索教会
          </button>
        </div>

        {/* 邀请码加入 */}
        {tab === 'code' && (
          <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">教会邀请码</p>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="输入 6 位邀请码"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3
                         text-center text-xl font-black tracking-[0.3em] text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <button type="button" onClick={joinByCode} disabled={joining}
              className="w-full flex items-center justify-center gap-2 rounded-2xl
                         bg-gradient-to-r from-violet-500 to-purple-500 py-3.5
                         text-sm font-bold text-white hover:opacity-90
                         disabled:opacity-60 shadow-md shadow-violet-500/20 transition-opacity">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              加入教会
            </button>
          </div>
        )}

        {/* 搜索教会 */}
        {tab === 'search' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">按名称搜索</p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchChurches()}
                    placeholder="教会名称或城市…"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3 py-2.5
                               text-sm text-stone-800 placeholder-stone-300
                               focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <button type="button" onClick={searchChurches} disabled={searching || !query.trim()}
                  className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white
                             hover:bg-violet-600 disabled:opacity-60 transition-colors">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map(c => (
                  <div key={c.id}
                    className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-900">{c.name}</p>
                        {(c.city || c.address) && (
                          <p className="text-xs text-stone-400 mt-0.5 truncate">
                            {[c.city, c.address].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => joinChurch(c.id, c.name)}
                        disabled={joining}
                        className="shrink-0 rounded-xl bg-violet-50 border border-violet-200
                                   px-3 py-1.5 text-xs font-bold text-violet-600
                                   hover:bg-violet-100 disabled:opacity-60 transition-colors">
                        加入
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.length === 0 && query && !searching && (
              <p className="text-center text-xs text-stone-400 py-4">未找到匹配的教会</p>
            )}
          </div>
        )}

        {/* 跳过 */}
        <Link href="/settings"
          className="block text-center text-xs text-stone-400 hover:text-stone-500 transition-colors py-2">
          暂不加入教会，稍后再说
        </Link>
      </main>
    </div>
  )
}
