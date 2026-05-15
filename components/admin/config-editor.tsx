'use client'

import { useState, useCallback } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SystemConfig } from '@/app/api/admin/config/route'

interface ConfigEditorProps {
  configs: SystemConfig[]
}

// Human-readable labels for well-known keys
const CONFIG_LABELS: Record<string, string> = {
  ai_circuit_breaker: 'AI 熔断器',
  global_notice:      '全局公告',
  donation_settings:  '捐献设置',
  payment_links:      '支付链接',
  cost_rates:         '成本单价参考',
}

export function ConfigEditor({ configs: initialConfigs }: ConfigEditorProps) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [editing, setEditing] = useState<string | null>(null)     // key being edited
  const [draftJson, setDraftJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)

  const startEdit = useCallback((cfg: SystemConfig) => {
    setEditing(cfg.key)
    setDraftJson(JSON.stringify(cfg.value, null, 2))
    setJsonError(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditing(null)
    setDraftJson('')
    setJsonError(null)
  }, [])

  const saveEdit = useCallback(async (key: string) => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(draftJson)
    } catch {
      setJsonError('JSON 格式有误，请检查')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value: parsed }),
      })
      if (!res.ok) throw new Error('save_failed')

      // Update local state
      setConfigs((prev) => prev.map((c) => c.key === key ? { ...c, value: parsed, updated_at: new Date().toISOString() } : c))
      setEditing(null)
    } catch {
      setJsonError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }, [draftJson])

  return (
    <section>
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        系统配置
      </p>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-muted-foreground w-44">
                配置项
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">
                当前值
              </th>
              <th className="py-2.5 pl-3 pr-4 text-left text-xs font-medium text-muted-foreground w-28">
                更新时间
              </th>
              <th className="py-2.5 pl-3 pr-4 w-16" />
            </tr>
          </thead>
          <tbody>
            {configs.map((cfg, i) => (
              <tr
                key={cfg.key}
                className={cn(
                  'border-b border-border last:border-0',
                  editing === cfg.key ? 'bg-gold-400/4' : 'hover:bg-muted/30',
                )}
              >
                {/* Key */}
                <td className="py-3 pl-4 pr-3 align-top">
                  <p className="font-medium text-foreground">
                    {CONFIG_LABELS[cfg.key] ?? cfg.key}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 font-mono">{cfg.key}</p>
                </td>

                {/* Value — collapsed preview or editor */}
                <td className="py-3 px-3 align-top">
                  {editing === cfg.key ? (
                    <div>
                      <textarea
                        value={draftJson}
                        onChange={(e) => { setDraftJson(e.target.value); setJsonError(null) }}
                        rows={Math.min(10, draftJson.split('\n').length + 1)}
                        className={cn(
                          'w-full rounded-lg border bg-card px-3 py-2 font-mono text-xs resize-y',
                          'focus:outline-none focus:ring-2 focus:ring-ring',
                          jsonError ? 'border-destructive' : 'border-border',
                        )}
                        spellCheck={false}
                      />
                      {jsonError && (
                        <p className="mt-1 text-xs text-destructive">{jsonError}</p>
                      )}
                    </div>
                  ) : (
                    <pre className="font-mono text-xs text-muted-foreground truncate max-w-xs overflow-hidden">
                      {JSON.stringify(cfg.value)}
                    </pre>
                  )}
                </td>

                {/* Updated at */}
                <td className="py-3 pl-3 pr-4 align-top text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(cfg.updated_at).toLocaleDateString('zh-CN')}
                </td>

                {/* Actions */}
                <td className="py-3 pl-3 pr-4 align-top">
                  {editing === cfg.key ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(cfg.key)}
                        disabled={saving}
                        className="rounded-lg p-1.5 text-sage-600 hover:bg-sage-100 transition-colors disabled:opacity-50"
                        title="保存"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                        title="取消"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(cfg)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
