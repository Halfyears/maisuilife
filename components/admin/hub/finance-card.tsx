'use client'

import { useState } from 'react'
import { DollarSign, Pencil, Save, X, Loader2 } from 'lucide-react'

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

function valueToDisplay(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function parseValue(raw: string, original: unknown): unknown {
  if (typeof original === 'number') return Number(raw)
  if (typeof original === 'boolean') return raw === '是' || raw === 'true'
  return raw
}

function ConfigTable({ cfg }: { cfg: SystemConfig }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const entries = Object.entries(cfg.value)

  function startEdit() {
    const initial: Record<string, string> = {}
    for (const [k, v] of entries) initial[k] = valueToDisplay(v)
    setDraft(initial)
    setEditing(true)
    setError(null)
  }

  function cancel() { setEditing(false); setError(null) }

  async function save() {
    const updated: Record<string, unknown> = {}
    for (const [k, v] of entries) {
      updated[k] = parseValue(draft[k] ?? '', v)
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: cfg.key, value: updated }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <div>
          <p className="text-xs font-semibold text-stone-800">{LABEL[cfg.key] ?? cfg.key}</p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            更新于 {new Date(cfg.updated_at).toLocaleDateString('zh-CN')}
          </p>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={save}
                  className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
                >
                  <Save className="h-3 w-3" />保存
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <Pencil className="h-3 w-3" />编辑
          </button>
        )}
      </div>
      {error && <p className="px-4 py-1.5 text-xs text-red-600 bg-red-50">{error}</p>}
      {entries.length === 0 ? (
        <p className="px-4 py-3 text-xs text-stone-400">暂无配置项</p>
      ) : (
        <table className="w-full text-xs">
          <tbody className="divide-y divide-stone-100">
            {entries.map(([k, v]) => (
              <tr key={k} className="hover:bg-stone-50">
                <td className="px-4 py-2 text-stone-500 font-medium w-2/5">{k}</td>
                <td className="px-4 py-2 text-stone-800">
                  {editing ? (
                    <input
                      type="text"
                      value={draft[k] ?? ''}
                      onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  ) : (
                    valueToDisplay(v)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function FinanceCard({ configs }: FinanceCardProps) {
  const financeConfigs = configs.filter(c => FINANCE_KEYS.includes(c.key as typeof FINANCE_KEYS[number]))

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <DollarSign className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="font-semibold text-foreground">财务 & 配置</h2>
      </div>

      {financeConfigs.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无财务配置项</p>
      ) : (
        <div className="space-y-3">
          {financeConfigs.map(cfg => (
            <ConfigTable key={cfg.key} cfg={cfg} />
          ))}
        </div>
      )}
    </div>
  )
}
