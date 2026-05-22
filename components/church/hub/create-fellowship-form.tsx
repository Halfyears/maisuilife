'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ClipboardCopy, CheckCircle2, Plus, Search, UserCheck, X } from 'lucide-react'

interface Candidate {
  id:           string
  display_name: string
}

export function CreateFellowshipForm() {
  const router = useRouter()
  const [open,        setOpen]        = useState(false)
  const [fellowName,  setFellowName]  = useState('')
  const [creating,    setCreating]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [result,      setResult]      = useState<{
    name: string; invite_code: string; leader_name: string | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // Leader search
  const [candidates,   setCandidates]   = useState<Candidate[]>([])
  const [loadingCands, setLoadingCands] = useState(false)
  const [search,       setSearch]       = useState('')
  const [selectedLeader, setSelectedLeader] = useState<Candidate | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setLoadingCands(true)
    fetch('/api/admin/leader-candidates')
      .then(r => r.json())
      .then(data => setCandidates(data.candidates ?? []))
      .catch(() => setCandidates([]))
      .finally(() => setLoadingCands(false))
  }, [open])

  const filteredCandidates = candidates.filter(c =>
    c.display_name.toLowerCase().includes(search.toLowerCase())
  )

  function reset() {
    setOpen(false); setError(null); setFellowName('')
    setSelectedLeader(null); setSearch('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/admin/create-fellowship', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      fellowName.trim(),
          leader_id: selectedLeader?.id ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = {
          leader_not_found:    '未找到该成员',
          leader_role_required: '该用户角色不足，请先提升为组长',
          invalid_params:       '请填写团契名称',
        }
        setError(msgs[data.error] ?? '创建失败，请重试')
        return
      }
      setResult(data)
      router.refresh()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setCreating(false)
    }
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(result.invite_code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-xl border border-dashed border-violet-300
                   bg-violet-50/50 px-4 py-3 text-sm font-medium text-violet-600
                   hover:bg-violet-100 active:scale-[0.99] transition-all">
        <Plus className="h-4 w-4" />新建团契
      </button>
    )
  }

  if (result) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-stone-900">{result.name}</p>
            <p className="text-xs text-stone-500">
              {result.leader_name ? `组长：${result.leader_name}` : '暂无组长（牧师/传道代管）'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-center">
            <p className="text-[10px] text-stone-400">邀请码</p>
            <p className="text-xl font-black tracking-[0.2em] text-amber-600 font-mono mt-0.5">
              {result.invite_code}
            </p>
          </div>
          <button onClick={copy}
            className="flex h-14 w-11 items-center justify-center rounded-lg border border-green-200 bg-white
                       hover:bg-green-50 transition-colors">
            {copied
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <ClipboardCopy className="h-4 w-4 text-stone-400" />}
          </button>
        </div>
        <button onClick={() => { setResult(null); reset() }}
          className="w-full rounded-lg border border-stone-200 py-2 text-xs text-stone-500 hover:bg-stone-50 transition-colors">
          完成
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-stone-800">新建团契</p>
        <button type="button" onClick={reset}
          className="rounded-lg p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 团契名称 */}
      <div>
        <label className="text-xs text-stone-500 mb-1 block">团契名称 <span className="text-red-400">*</span></label>
        <input required value={fellowName} onChange={e => setFellowName(e.target.value)}
          placeholder="例：主日查经小组"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-violet-300" />
      </div>

      {/* 组长选择（可选） */}
      <div>
        <label className="text-xs text-stone-500 mb-1 block flex items-center gap-1">
          <UserCheck className="h-3.5 w-3.5" />
          选择组长
          <span className="text-stone-400 font-normal">（可选，暂无则由牧师/传道代管）</span>
        </label>

        {selectedLeader ? (
          <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
            <span className="text-sm font-medium text-stone-800 flex-1">{selectedLeader.display_name}</span>
            <button type="button" onClick={() => setSelectedLeader(null)}
              className="text-stone-400 hover:text-stone-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-300" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索组长姓名…"
                className="w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            {loadingCands ? (
              <p className="text-xs text-stone-400 px-1 py-2 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />加载组长名单…
              </p>
            ) : filteredCandidates.length === 0 ? (
              <p className="text-xs text-stone-400 px-1 py-2">
                {search ? '未找到匹配的组长' : '暂无未分配团契的组长'}
              </p>
            ) : (
              <ul className="max-h-36 overflow-y-auto rounded-lg border border-stone-100 bg-white divide-y divide-stone-50">
                {filteredCandidates.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedLeader(c); setSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-violet-50 transition-colors"
                    >
                      {c.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={creating || !fellowName.trim()}
          className="flex-1 rounded-lg bg-violet-500 py-2.5 text-sm font-bold text-white
                     hover:bg-violet-600 disabled:opacity-60 transition-colors">
          {creating
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />创建中…
              </span>
            : '创建并生成邀请码'}
        </button>
        <button type="button" onClick={reset}
          className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 transition-colors">
          取消
        </button>
      </div>
    </form>
  )
}
