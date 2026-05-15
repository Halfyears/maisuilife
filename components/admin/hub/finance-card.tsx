'use client'

import { useState } from 'react'
import { DollarSign, Save, RotateCcw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SystemConfig {
  id:         string
  key:        string
  value:      Record<string, unknown>
  updated_at: string
}

interface FinanceCardProps {
  configs: SystemConfig[]
}

const FINANCE_KEYS = ['donation_settings', 'payment_links', 'cost_rates'] as const
const LABEL: Record<string, string> = {
  donation_settings: '奉献设置',
  payment_links:     '支付链接',
  cost_rates:        'AI 费率',
}

export function FinanceCard({ configs }: FinanceCardProps) {
  const financeConfigs = configs.filter(c => FINANCE_KEYS.includes(c.key as typeof FINANCE_KEYS[number]))
  const [editing, setEditing] = useState<string | null>(null)
  const [drafts, setDrafts]   = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const startEdit = (cfg: SystemConfig) => {
    setEditing(cfg.key)
    setDrafts(d => ({ ...d, [cfg.key]: JSON.stringify(cfg.value, null, 2) }))
    setError(null)
  }

  const cancelEdit = () => { setEditing(null); setError(null) }

  const save = async (key: string) => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(drafts[key] ?? '{}')
    } catch {
      setError('JSON 格式有误，请检查')
      return
    }
    setSaving(key)
    setError(null)
    try {
      const res = await fetch('/api/admin/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value: parsed }),
      })
      if (!res.ok) throw new Error('save failed')
      setEditing(null)
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400/15">
          <DollarSign className="h-4 w-4 text-gold-600" />
        </div>
        <h2 className="font-semibold text-foreground">财务 & 配置</h2>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {/* Config rows */}
      <div className="space-y-3">
        {financeConfigs.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无财务配置项</p>
        )}
        {financeConfigs.map(cfg => (
          <div key={cfg.key} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">{LABEL[cfg.key] ?? cfg.key}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  更新于 {new Date(cfg.updated_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {editing !== cfg.key ? (
                <button
                  type="button"
                  onClick={() => startEdit(cfg)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                >
                  编辑
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {saving === cfg.key ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => save(cfg.key)}
                        className="flex items-center gap-1 rounded-lg bg-gold-400 px-2.5 py-1 text-xs font-medium text-gold-900 hover:bg-gold-500 transition-colors"
                      >
                        <Save className="h-3 w-3" /> 保存
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {editing === cfg.key ? (
              <textarea
                value={drafts[cfg.key] ?? ''}
                onChange={e => setDrafts(d => ({ ...d, [cfg.key]: e.target.value }))}
                className={cn(
                  'w-full rounded-lg border border-border bg-card px-2.5 py-2 font-mono text-xs',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'resize-none',
                )}
                rows={6}
                spellCheck={false}
              />
            ) : (
              <pre className="overflow-x-auto rounded-lg bg-muted/40 px-2.5 py-2 text-[10px] text-muted-foreground leading-relaxed">
                {JSON.stringify(cfg.value, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
