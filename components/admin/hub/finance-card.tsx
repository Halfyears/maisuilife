'use client'

import { useState } from 'react'
import { DollarSign, Link2, Cpu, Pencil, Save, X, Loader2 } from 'lucide-react'

interface SystemConfig {
  id: string; key: string; value: Record<string, unknown>; updated_at: string
}

// ── Donation Settings Form ───────────────────────────────────────────────────
const PAGE_OPTIONS = [
  { key: 'daily',       label: '今日内室' },
  { key: 'fellowship',  label: '麦穗团契' },
  { key: 'growth',      label: '灵命成长' },
  { key: 'settings',    label: '设置中心' },
  { key: 'accountability', label: '同行小组' },
]
const CURRENCY_OPTIONS = ['USD', 'CNY', 'HKD', 'TWD', 'SGD']

function DonationSettingsForm({ cfg }: { cfg: SystemConfig }) {
  const v = cfg.value
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [title,     setTitle]     = useState(String(v.title ?? '感恩奉献'))
  const [desc,      setDesc]      = useState(String(v.description ?? ''))
  const [amounts,   setAmounts]   = useState(
    Array.isArray(v.amounts) ? (v.amounts as number[]).join(', ') : '20, 50, 100, 200'
  )
  const [defAmt,    setDefAmt]    = useState(String(v.default_amount ?? '50'))
  const [currency,  setCurrency]  = useState(String(v.currency ?? 'USD'))
  const [showOn,    setShowOn]    = useState<string[]>(
    Array.isArray(v.show_on) ? v.show_on as string[] : []
  )

  function togglePage(key: string) {
    setShowOn(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  async function save() {
    setSaving(true); setError(null)
    const amtsArr = amounts.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
    const value = {
      title:          title.trim(),
      description:    desc.trim(),
      amounts:        amtsArr,
      default_amount: Number(defAmt) || 50,
      currency,
      show_on:        showOn,
    }
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cfg.key, value }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
    } catch { setError('保存失败，请重试') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <div>
          <p className="text-xs font-semibold text-stone-800">奉献设置</p>
          <p className="text-[10px] text-stone-400 mt-0.5">更新于 {new Date(cfg.updated_at).toLocaleDateString('zh-CN')}</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
              <>
                <button onClick={save} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors">
                  <Save className="h-3 w-3" />保存
                </button>
                <button onClick={() => { setEditing(false); setError(null) }} className="rounded-lg border border-stone-200 p-1 text-stone-400 hover:bg-stone-100 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors">
            <Pencil className="h-3 w-3" />编辑
          </button>
        )}
      </div>
      {error && <p className="px-4 py-1.5 text-xs text-red-600 bg-red-50">{error}</p>}
      <div className="px-4 py-3 space-y-3">
        <Field label="奉献标题">
          {editing
            ? <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
            : <Val>{title || '—'}</Val>}
        </Field>
        <Field label="奉献说明">
          {editing
            ? <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            : <Val>{desc || '—'}</Val>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="金额选项（逗号分隔）">
            {editing
              ? <input value={amounts} onChange={e => setAmounts(e.target.value)} placeholder="20, 50, 100, 200" className={inputCls} />
              : <Val>{amounts}</Val>}
          </Field>
          <Field label="默认金额">
            {editing
              ? <input type="number" value={defAmt} onChange={e => setDefAmt(e.target.value)} min={0} className={inputCls} />
              : <Val>{defAmt}</Val>}
          </Field>
        </div>
        <Field label="货币">
          {editing
            ? (
              <div className="flex flex-wrap gap-1.5">
                {CURRENCY_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setCurrency(c)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${currency === c ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 text-stone-500 hover:bg-stone-100'}`}>
                    {c}
                  </button>
                ))}
              </div>
            )
            : <Val>{currency}</Val>}
        </Field>
        <Field label="显示页面">
          {editing
            ? (
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showOn.includes(p.key)} onChange={() => togglePage(p.key)}
                      className="rounded border-stone-300 accent-amber-500" />
                    <span className="text-xs text-stone-600">{p.label}</span>
                  </label>
                ))}
              </div>
            )
            : <Val>{showOn.length > 0 ? showOn.map(k => PAGE_OPTIONS.find(p => p.key === k)?.label ?? k).join('、') : '未设置'}</Val>}
        </Field>
      </div>
    </div>
  )
}

// ── Payment Links Form ────────────────────────────────────────────────────────
const PAYMENT_FIELDS = [
  { key: 'wechat_pay', label: '微信支付链接' },
  { key: 'alipay',     label: '支付宝链接'   },
  { key: 'paypal',     label: 'PayPal 链接'  },
  { key: 'venmo',      label: 'Venmo'        },
  { key: 'zelle',      label: 'Zelle'        },
  { key: 'label',      label: '按钮文字'      },
]

function PaymentLinksForm({ cfg }: { cfg: SystemConfig }) {
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(PAYMENT_FIELDS.map(f => [f.key, String(cfg.value[f.key] ?? '')]))
  )

  async function save() {
    setSaving(true); setError(null)
    const value: Record<string, string> = {}
    for (const f of PAYMENT_FIELDS) value[f.key] = draft[f.key].trim()
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cfg.key, value }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
    } catch { setError('保存失败，请重试') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <div>
          <p className="text-xs font-semibold text-stone-800">奉献收款链接</p>
          <p className="text-[10px] text-stone-400 mt-0.5">更新于 {new Date(cfg.updated_at).toLocaleDateString('zh-CN')}</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
              <>
                <button onClick={save} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors">
                  <Save className="h-3 w-3" />保存
                </button>
                <button onClick={() => { setEditing(false); setError(null) }} className="rounded-lg border border-stone-200 p-1 text-stone-400 hover:bg-stone-100 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors">
            <Pencil className="h-3 w-3" />编辑
          </button>
        )}
      </div>
      {error && <p className="px-4 py-1.5 text-xs text-red-600 bg-red-50">{error}</p>}
      <div className="px-4 py-3 space-y-2.5">
        {PAYMENT_FIELDS.map(f => (
          <Field key={f.key} label={f.label}>
            {editing
              ? <input value={draft[f.key]} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.key === 'label' ? '例：感恩奉献' : 'https://…'} className={inputCls} />
              : <Val>{draft[f.key] || <span className="text-stone-300">未设置</span>}</Val>}
          </Field>
        ))}
      </div>
    </div>
  )
}

// ── Generic raw config (for cost_rates, etc.) ────────────────────────────────
function RawConfigTable({ cfg }: { cfg: SystemConfig }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const entries = Object.entries(cfg.value)
  const LABEL: Record<string, string> = { cost_rates: 'AI 费率配置' }

  function startEdit() {
    setDraft(Object.fromEntries(entries.map(([k, v]) => [k, String(v)])))
    setEditing(true); setError(null)
  }

  async function save() {
    const updated: Record<string, unknown> = {}
    for (const [k, v] of entries) {
      const raw = draft[k] ?? ''
      updated[k] = typeof v === 'number' ? Number(raw) : typeof v === 'boolean' ? raw === 'true' : raw
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cfg.key, value: updated }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
    } catch { setError('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <p className="text-xs font-semibold text-stone-800">{LABEL[cfg.key] ?? cfg.key}</p>
        {editing ? (
          <div className="flex items-center gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
              <>
                <button onClick={save} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors">
                  <Save className="h-3 w-3" />保存
                </button>
                <button onClick={() => { setEditing(false); setError(null) }} className="rounded-lg border border-stone-200 p-1 text-stone-400 hover:bg-stone-100 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button onClick={startEdit} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors">
            <Pencil className="h-3 w-3" />编辑
          </button>
        )}
      </div>
      {error && <p className="px-4 py-1.5 text-xs text-red-600 bg-red-50">{error}</p>}
      <table className="w-full text-xs">
        <tbody className="divide-y divide-stone-100">
          {entries.map(([k, v]) => (
            <tr key={k} className="hover:bg-stone-50">
              <td className="px-4 py-2 text-stone-500 font-medium w-2/5">{k}</td>
              <td className="px-4 py-2 text-stone-800">
                {editing
                  ? <input value={draft[k] ?? ''} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} className={inputCls} />
                  : String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  )
}

function Val({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-stone-700 break-all">{children}</p>
}

// ── Main export ───────────────────────────────────────────────────────────────
export function FinanceCard({ configs }: { configs: SystemConfig[] }) {
  const donationCfg = configs.find(c => c.key === 'donation_settings')
  const paymentCfg  = configs.find(c => c.key === 'payment_links')
  const otherCfgs   = configs.filter(c => !['donation_settings', 'payment_links'].includes(c.key))

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <DollarSign className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="font-semibold text-foreground">奉献 & 财务配置</h2>
      </div>

      {donationCfg && <DonationSettingsForm cfg={donationCfg} />}
      {paymentCfg  && <PaymentLinksForm    cfg={paymentCfg}  />}
      {otherCfgs.map(cfg => <RawConfigTable key={cfg.key} cfg={cfg} />)}

      {configs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          暂无配置项。请在数据库 system_configs 表中插入 donation_settings 和 payment_links 记录。
        </p>
      )}

      <div className="flex items-center gap-1.5 pt-1 border-t border-stone-100">
        <Link2 className="h-3 w-3 text-stone-300" />
        <Cpu className="h-3 w-3 text-stone-300" />
        <p className="text-[10px] text-stone-300">配置即时生效，无需重新部署</p>
      </div>
    </div>
  )
}
