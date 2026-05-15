'use client'

import { useState, useCallback } from 'react'
import {
  Zap, CloudLightning, ShieldCheck, Loader2,
  Users, ClipboardCopy, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsCardProps {
  aiActive: boolean
}

export function QuickActionsCard({ aiActive: initialActive }: QuickActionsCardProps) {
  // ── Circuit breaker state ─────────────────────────────
  const [active, setActive]         = useState(initialActive)
  const [cbLoading, setCbLoading]   = useState(false)
  const [cbConfirm, setCbConfirm]   = useState(false)

  // ── Create fellowship state ───────────────────────────
  const [fellowName, setFellowName]   = useState('')
  const [leaderEmail, setLeaderEmail] = useState('')
  const [creating, setCreating]       = useState(false)
  const [result, setResult]           = useState<{
    fellowship_id: string; name: string; invite_code: string; leader_name: string
  } | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)

  // ── Circuit breaker toggle ────────────────────────────
  const toggleCircuit = useCallback(async () => {
    const next = !active
    if (!next && !cbConfirm) {
      setCbConfirm(true)
      setTimeout(() => setCbConfirm(false), 4000)
      return
    }
    setCbLoading(true)
    setCbConfirm(false)
    try {
      const res = await fetch('/api/admin/circuit-breaker', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: next }),
      })
      if (res.ok) setActive(next)
    } finally {
      setCbLoading(false)
    }
  }, [active, cbConfirm])

  // ── Create fellowship ─────────────────────────────────
  const createFellowship = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/create-fellowship', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: fellowName.trim(), leader_email: leaderEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg: Record<string, string> = {
          leader_not_found:   '未找到该邮箱对应用户，请确认用户已注册',
          leader_role_required: data.message ?? '用户角色不足',
          invalid_params:     '请检查团契名称和邮箱格式',
        }
        setCreateError(msg[data.error] ?? '创建失败，请重试')
        return
      }
      setResult(data)
      setFellowName('')
      setLeaderEmail('')
    } catch {
      setCreateError('网络错误，请重试')
    } finally {
      setCreating(false)
    }
  }

  const copyCode = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-6 col-span-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
          <Zap className="h-4 w-4 text-purple-500" />
        </div>
        <h2 className="font-semibold text-foreground">快捷操作</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* ── Circuit Breaker ─────────────────────────── */}
        <div className={cn(
          'rounded-xl border p-4 space-y-3 transition-colors',
          active ? 'border-border bg-muted/20' : 'border-destructive/30 bg-destructive/5',
        )}>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              active ? 'bg-sage-100 text-sage-600' : 'bg-destructive/15 text-destructive',
            )}>
              {active
                ? <ShieldCheck className="h-4 w-4" />
                : <CloudLightning className="h-4 w-4" />
              }
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">全局 AI 熔断器</p>
              <p className={cn('text-xs', active ? 'text-sage-600' : 'text-destructive')}>
                {active ? '服务正常运行中' : 'AI 已熔断 — 所有 STT 请求被拒绝'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {active
              ? '关闭后，全网所有录音提交将立即返回 503。需二次确认。'
              : '开启后，全网恢复 AI 处理。已中断的请求需用户重新提交。'
            }
          </p>
          {cbLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 处理中…
            </div>
          ) : active ? (
            <button
              type="button"
              onClick={toggleCircuit}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                cbConfirm
                  ? 'border-destructive bg-destructive text-white animate-pulse'
                  : 'border-destructive/40 text-destructive hover:bg-destructive hover:text-white',
              )}
            >
              {cbConfirm ? '⚠ 再次点击确认熔断' : '立即熔断'}
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCircuit}
              className="rounded-lg border border-sage-300 bg-sage-100 px-4 py-2 text-sm font-medium text-sage-700 hover:bg-sage-200 transition-colors"
            >
              恢复 AI
            </button>
          )}
        </div>

        {/* ── Create Fellowship ────────────────────────── */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400/15">
              <Users className="h-4 w-4 text-gold-600" />
            </div>
            <p className="text-sm font-medium text-foreground">新建团契</p>
          </div>

          {result ? (
            /* ── Success state ── */
            <div className="space-y-3">
              <div className="rounded-lg bg-sage-50 border border-sage-200 p-3 space-y-1">
                <p className="text-xs text-sage-700 font-medium">✓ 团契已创建</p>
                <p className="text-sm font-semibold text-foreground">{result.name}</p>
                <p className="text-xs text-muted-foreground">组长：{result.leader_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-card border border-border px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">邀请码</p>
                  <p className="text-xl font-bold tracking-widest text-gold-600 font-mono mt-0.5">
                    {result.invite_code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex h-14 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                  title="复制邀请码"
                >
                  {copied
                    ? <CheckCircle2 className="h-4 w-4 text-sage-500" />
                    : <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="w-full rounded-lg border border-border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                新建另一个团契
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <form onSubmit={createFellowship} className="space-y-2.5">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">团契名称</label>
                <input
                  type="text"
                  required
                  value={fellowName}
                  onChange={e => setFellowName(e.target.value)}
                  placeholder="例：主日查经小组"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">组长邮箱</label>
                <input
                  type="email"
                  required
                  value={leaderEmail}
                  onChange={e => setLeaderEmail(e.target.value)}
                  placeholder="leader@example.com"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {createError && (
                <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">{createError}</p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-gold-400 py-2 text-sm font-medium text-gold-900 hover:bg-gold-500 transition-colors disabled:opacity-60"
              >
                {creating ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />创建中…</span> : '创建团契并生成邀请码'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
