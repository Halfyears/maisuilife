'use client'

import { useState } from 'react'
import { DollarSign, Pencil, Save, X, Loader2 } from 'lucide-react'

interface SystemConfig {
  id: string; key: string; value: Record<string, unknown>; updated_at: string
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PAGE_OPTIONS = [
  { key: 'daily',          label: '今日内室'  },
  { key: 'fellowship',     label: '麦穗团契'  },
  { key: 'growth',         label: '灵命成长'  },
  { key: 'settings',       label: '设置中心'  },
  { key: 'accountability', label: '同行小组'  },
]
const CURRENCY_OPTIONS = ['USD', 'CNY', 'HKD', 'TWD', 'SGD']
const PAYMENT_FIELDS = [
  { key: 'wechat_pay', label: '微信支付' },
  { key: 'alipay',     label: '支付宝'   },
  { key: 'paypal',     label: 'PayPal'   },
  { key: 'venmo',      label: 'Venmo'    },
  { key: 'zelle',      label: 'Zelle'    },
]

function pageLabel(key: string) {
  return PAGE_OPTIONS.find(p => p.key === key)?.label ?? key
}

async function patchConfig(key: string, value: Record<string, unknown>) {
  const res = await fetch('/api/admin/config', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new Error()
}

// ── Donation Settings ─────────────────────────────────────────────────────────
function DonationSection({ cfg }: { cfg: SystemConfig }) {
  const v = cfg.value
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [title,   setTitle]   = useState(String(v.title    ?? '感恩奉献'))
  const [desc,    setDesc]    = useState(String(v.description ?? ''))
  const [amounts, setAmounts] = useState(
    Array.isArray(v.amounts) ? (v.amounts as number[]).join(', ') : '20, 50, 100, 200'
  )
  const [defAmt,   setDefAmt]   = useState(String(v.default_amount ?? 50))
  const [currency, setCurrency] = useState(String(v.currency ?? 'USD'))
  const [showOn,   setShowOn]   = useState<string[]>(
    Array.isArray(v.show_on) ? v.show_on as string[] : []
  )

  const amtsArr   = amounts.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
  const pagesText = showOn.length ? showOn.map(pageLabel).join('、') : '未设置显示页面'

  async function save() {
    setSaving(true); setError(null)
    try {
      await patchConfig(cfg.key, {
        title: title.trim(), description: desc.trim(),
        amounts: amtsArr, default_amount: Number(defAmt) || 50,
        currency, show_on: showOn,
      })
      setOpen(false)
    } catch { setError('保存失败，请重试') }
    finally   { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      {/* ── 文字展示 ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm font-bold text-stone-900">{title || '（未命名）'}</p>
          {desc && <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>}
          <p className="text-xs text-stone-500">
            金额选项：{amtsArr.length ? amtsArr.map(a => `${currency} ${a}`).join(' · ') : '未设置'}
            {defAmt && ` · 默认 ${currency} ${defAmt}`}
          </p>
          <p className="text-xs text-stone-400">显示于：{pagesText}</p>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>

      {/* ── 编辑面板 ── */}
      {open && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
          <Row label="奉献标题">
            <input value={title} onChange={e => setTitle(e.target.value)} className={inp} />
          </Row>
          <Row label="说明文字">
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className={`${inp} resize-none`} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="金额选项（逗号分隔）">
              <input value={amounts} onChange={e => setAmounts(e.target.value)}
                placeholder="20, 50, 100, 200" className={inp} />
            </Row>
            <Row label="默认金额">
              <input type="number" value={defAmt} onChange={e => setDefAmt(e.target.value)} className={inp} />
            </Row>
          </div>
          <Row label="货币">
            <div className="flex flex-wrap gap-1.5">
              {CURRENCY_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors
                    ${currency === c ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 text-stone-500 hover:bg-stone-100'}`}>
                  {c}
                </button>
              ))}
            </div>
          </Row>
          <Row label="显示页面">
            <div className="flex flex-wrap gap-2">
              {PAGE_OPTIONS.map(p => (
                <label key={p.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOn.includes(p.key)}
                    onChange={() => setShowOn(prev => prev.includes(p.key) ? prev.filter(x => x !== p.key) : [...prev, p.key])}
                    className="rounded border-stone-300 accent-amber-500" />
                  <span className="text-xs text-stone-600">{p.label}</span>
                </label>
              ))}
            </div>
          </Row>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              : <>
                  <button onClick={save}
                    className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5
                               text-xs font-bold text-white hover:bg-amber-600 transition-colors">
                    <Save className="h-3 w-3" />保存
                  </button>
                  <button onClick={() => { setOpen(false); setError(null) }}
                    className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-stone-100 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payment Links ─────────────────────────────────────────────────────────────
function PaymentSection({ cfg }: { cfg: SystemConfig }) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [draft,  setDraft]  = useState<Record<string, string>>(
    Object.fromEntries(
      [...PAYMENT_FIELDS.map(f => f.key), 'label']
        .map(k => [k, String(cfg.value[k] ?? '')])
    )
  )

  const configured = PAYMENT_FIELDS.filter(f => draft[f.key]?.trim())

  async function save() {
    setSaving(true); setError(null)
    try {
      const value: Record<string, string> = {}
      for (const k of [...PAYMENT_FIELDS.map(f => f.key), 'label']) value[k] = draft[k]?.trim() ?? ''
      await patchConfig(cfg.key, value)
      setOpen(false)
    } catch { setError('保存失败') }
    finally   { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-stone-500">
            {configured.length
              ? configured.map(f => f.label).join(' · ') + ' 已配置'
              : '暂未配置收款链接'}
          </p>
          {draft.label && (
            <p className="text-xs text-stone-400 mt-0.5">按钮文字：{draft.label}</p>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
          {[...PAYMENT_FIELDS, { key: 'label', label: '按钮文字' }].map(f => (
            <Row key={f.key} label={f.label}>
              <input value={draft[f.key] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.key === 'label' ? '感恩奉献' : 'https://…'}
                className={inp} />
            </Row>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              : <>
                  <button onClick={save}
                    className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5
                               text-xs font-bold text-white hover:bg-amber-600 transition-colors">
                    <Save className="h-3 w-3" />保存
                  </button>
                  <button onClick={() => { setOpen(false); setError(null) }}
                    className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-stone-100 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generic raw config ────────────────────────────────────────────────────────
function RawSection({ cfg }: { cfg: SystemConfig }) {
  const [open,   setOpen]   = useState(false)
  const [raw,    setRaw]    = useState(JSON.stringify(cfg.value, null, 2))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function save() {
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(raw) } catch { setError('JSON 格式错误'); return }
    setSaving(true); setError(null)
    try { await patchConfig(cfg.key, parsed); setOpen(false) }
    catch { setError('保存失败') }
    finally { setSaving(false) }
  }

  const LABELS: Record<string, string> = { cost_rates: 'AI 费率参考' }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">{LABELS[cfg.key] ?? cfg.key}</p>
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={6}
            className={`${inp} font-mono resize-none`} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              : <>
                  <button onClick={save}
                    className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5
                               text-xs font-bold text-white hover:bg-amber-600 transition-colors">
                    <Save className="h-3 w-3" />保存
                  </button>
                  <button onClick={() => setOpen(false)}
                    className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-stone-100 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────
const inp = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function FinanceCard({ configs }: { configs: SystemConfig[] }) {
  const donationCfg = configs.find(c => c.key === 'donation_settings')
  const paymentCfg  = configs.find(c => c.key === 'payment_links')
  const otherCfgs   = configs.filter(c => !['donation_settings', 'payment_links'].includes(c.key))

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <DollarSign className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="font-semibold text-foreground">奉献 & 财务</h2>
      </div>

      {donationCfg && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">奉献设置</p>
          <DonationSection cfg={donationCfg} />
        </div>
      )}

      {paymentCfg && (
        <div className="pt-2 border-t border-stone-100">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">收款链接</p>
          <PaymentSection cfg={paymentCfg} />
        </div>
      )}

      {otherCfgs.map(cfg => (
        <div key={cfg.key} className="pt-2 border-t border-stone-100">
          <RawSection cfg={cfg} />
        </div>
      ))}

      {configs.length === 0 && (
        <p className="text-sm text-stone-400">
          暂无配置。请先在 Supabase 执行 system_configs 初始化 SQL。
        </p>
      )}
    </div>
  )
}
