'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ClipboardCopy, CheckCircle2, Plus } from 'lucide-react'

export function CreateFellowshipForm() {
  const router = useRouter()
  const [open,        setOpen]        = useState(false)
  const [fellowName,  setFellowName]  = useState('')
  const [leaderEmail, setLeaderEmail] = useState('')
  const [creating,    setCreating]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [result,      setResult]      = useState<{
    name: string; invite_code: string; leader_name: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/admin/create-fellowship', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fellowName.trim(), leader_email: leaderEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = {
          leader_not_found: '未找到该邮箱对应的用户，请确认已注册',
          invalid_params:   '请检查团契名称和邮箱',
        }
        setError(msgs[data.error] ?? '创建失败，请重试')
        return
      }
      setResult(data)
      setFellowName(''); setLeaderEmail('')
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

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full rounded-xl border border-dashed border-violet-300
                     bg-violet-50/50 px-4 py-3 text-sm font-medium text-violet-600
                     hover:bg-violet-100 active:scale-[0.99] transition-all">
          <Plus className="h-4 w-4" />新建团契
        </button>
      ) : result ? (
        <div className="rounded-xl border border-green-100 bg-green-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-stone-900">{result.name}</p>
              <p className="text-xs text-stone-500">组长：{result.leader_name}</p>
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
          <button onClick={() => { setResult(null); setOpen(false) }}
            className="w-full rounded-lg border border-stone-200 py-2 text-xs text-stone-500 hover:bg-stone-50 transition-colors">
            完成
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
          <p className="text-sm font-bold text-stone-800">新建团契</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">团契名称</label>
              <input required value={fellowName} onChange={e => setFellowName(e.target.value)}
                placeholder="例：主日查经小组"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">组长邮箱（须已注册）</label>
              <input required type="email" value={leaderEmail} onChange={e => setLeaderEmail(e.target.value)}
                placeholder="leader@example.com"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={creating}
              className="flex-1 rounded-lg bg-violet-500 py-2.5 text-sm font-bold text-white
                         hover:bg-violet-600 disabled:opacity-60 transition-colors">
              {creating
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />创建中…</span>
                : '创建并生成邀请码'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null) }}
              className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 transition-colors">
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
