'use client'

import { useState } from 'react'
import { DollarSign, Pencil, Save, X, Loader2, RefreshCw, Sparkles } from 'lucide-react'

interface SystemConfig {
  id: string; key: string; value: Record<string, unknown>; updated_at: string
}

interface Appeal {
  title: string
  body:  string
  pages: string[]
}

const PAGE_OPTIONS = [
  { key: 'daily',          label: '今日内室'  },
  { key: 'fellowship',     label: '麦穗团契'  },
  { key: 'growth',         label: '灵命成长'  },
  { key: 'settings',       label: '设置中心'  },
  { key: 'accountability', label: '同行小组'  },
]
const CURRENCY_OPTIONS = ['USD', 'CNY', 'HKD', 'TWD', 'SGD']
const PAYMENT_FIELDS = [
  { key: 'zelle',      label: 'Zelle'    },
  { key: 'venmo',      label: 'Venmo'    },
  { key: 'paypal',     label: 'PayPal'   },
  { key: 'wechat_pay', label: '微信支付' },
  { key: 'alipay',     label: '支付宝'   },
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

// ── Appeal card editor ────────────────────────────────────────────────────────
function AppealCard({
  appeal, index, onChange,
}: {
  appeal: Appeal
  index:  number
  onChange: (a: Appeal) => void
}) {
  const [editing, setEditing] = useState(false)

  function togglePage(key: string) {
    const next = appeal.pages.includes(key)
      ? appeal.pages.filter(p => p !== key)
      : [...appeal.pages, key]
    onChange({ ...appeal, pages: next })
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-white p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-amber-600 mb-1">#{index + 1}</p>
          {editing ? (
            <input
              value={appeal.title}
              onChange={e => onChange({ ...appeal, title: e.target.value })}
              className={inp}
              placeholder="标题"
            />
          ) : (
            <p className="text-xs font-bold text-stone-800 leading-snug">
              {appeal.title || <span className="text-stone-400">（未填标题）</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="shrink-0 rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-stone-100 transition-colors"
        >
          {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
        </button>
      </div>

      {editing ? (
        <textarea
          value={appeal.body}
          onChange={e => onChange({ ...appeal, body: e.target.value })}
          rows={3}
          className={`${inp} resize-none`}
          placeholder="奉献呼召文字…"
        />
      ) : (
        <p className="text-xs text-stone-500 leading-relaxed line-clamp-3">
          {appeal.body || <span className="text-stone-300">（未填内容）</span>}
        </p>
      )}

      {/* Page assignment */}
      <div>
        <p className="text-[10px] text-stone-400 mb-1.5">指定页面</p>
        <div className="flex flex-wrap gap-1.5">
          {PAGE_OPTIONS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => togglePage(p.key)}
              className={[
                'rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                appeal.pages.includes(p.key)
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'border-stone-200 text-stone-500 hover:bg-stone-100',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Donation Settings ─────────────────────────────────────────────────────────
function DonationSection({ cfg }: { cfg: SystemConfig }) {
  const v = cfg.value

  const defaultAppeals: Appeal[] = Array.isArray(v.appeals)
    ? (v.appeals as Appeal[]).map(a => ({
        title: String(a.title ?? ''),
        body:  String(a.body  ?? ''),
        pages: Array.isArray(a.pages) ? a.pages as string[] : [],
      }))
    : [
        { title: '', body: '', pages: ['daily']         },
        { title: '', body: '', pages: ['fellowship']    },
        { title: '', body: '', pages: ['growth']        },
      ]

  const [open,     setOpen]     = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [genning,  setGenning]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [appeals,  setAppeals]  = useState<Appeal[]>(defaultAppeals)
  const [amounts,  setAmounts]  = useState(
    Array.isArray(v.amounts) ? (v.amounts as number[]).join(', ') : '10, 20, 50'
  )
  const [currency, setCurrency] = useState(String(v.currency ?? 'USD'))
  const [showOn,   setShowOn]   = useState<string[]>(
    Array.isArray(v.show_on) ? v.show_on as string[] : []
  )

  const amtsArr    = amounts.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
  const pagesText  = showOn.length ? showOn.map(pageLabel).join('、') : '未设置显示页面'
  const hasAppeals = appeals.some(a => a.title)

  async function generate() {
    setGenning(true); setError(null)
    try {
      const res = await fetch('/api/admin/donation/generate', { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const gen: { title: string; body: string }[] = data.appeals ?? []
      setAppeals(prev =>
        prev.map((a, i) => gen[i] ? { ...a, title: gen[i].title, body: gen[i].body } : a)
      )
    } catch {
      setError('AI 生成失败，请重试')
    } finally {
      setGenning(false)
    }
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      await patchConfig(cfg.key, {
        appeals: appeals.map(a => ({
          title: a.title.trim(),
          body:  a.body.trim(),
          pages: a.pages,
        })),
        amounts: amtsArr,
        currency,
        show_on: showOn,
      })
      setOpen(false)
    } catch { setError('保存失败，请重试') }
    finally   { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      {/* Summary row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          {hasAppeals ? (
            appeals.filter(a => a.title).map((a, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-amber-500 font-bold shrink-0">#{i + 1}</span>
                <p className="text-xs font-medium text-stone-700 truncate">{a.title}</p>
                {a.pages.length > 0 && (
                  <span className="text-[10px] text-stone-400 shrink-0">
                    ({a.pages.map(pageLabel).join('/')})
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-400">暂无奉献呼召文字</p>
          )}
          <p className="text-xs text-stone-500">
            金额：{amtsArr.length ? amtsArr.map(a => `${currency} ${a}`).join(' · ') : '未设置'}
          </p>
          <p className="text-xs text-stone-400">显示于：{pagesText}</p>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>

      {/* Edit panel */}
      {open && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-4">

          {/* Appeals header + generate button */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
              奉献呼召短文（共3条）
            </p>
            <button
              onClick={generate}
              disabled={genning}
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white
                         px-3 py-1.5 text-xs font-bold text-amber-700
                         hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              {genning
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : hasAppeals
                  ? <RefreshCw  className="h-3 w-3" />
                  : <Sparkles   className="h-3 w-3" />
              }
              {genning ? '生成中…' : hasAppeals ? '刷新重新生成' : 'AI 自动生成'}
            </button>
          </div>

          {/* 3 appeal cards */}
          <div className="space-y-2.5">
            {appeals.map((a, i) => (
              <AppealCard
                key={i}
                index={i}
                appeal={a}
                onChange={updated => setAppeals(prev => prev.map((x, j) => j === i ? updated : x))}
              />
            ))}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <Row label="金额选项（逗号分隔）">
              <input value={amounts} onChange={e => setAmounts(e.target.value)}
                placeholder="10, 20, 50" className={inp} />
            </Row>
            <Row label="货币">
              <div className="flex flex-wrap gap-1.5">
                {CURRENCY_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setCurrency(c)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors
                      ${currency === c ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 text-stone-500 hover:bg-stone-100'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </Row>
          </div>

          {/* show_on */}
          <Row label="整体显示页面（全局开关）">
            <div className="flex flex-wrap gap-2">
              {PAGE_OPTIONS.map(p => (
                <label key={p.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOn.includes(p.key)}
                    onChange={() => setShowOn(prev =>
                      prev.includes(p.key) ? prev.filter(x => x !== p.key) : [...prev, p.key]
                    )}
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
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
          {PAYMENT_FIELDS.map(f => (
            <Row key={f.key} label={f.label}>
              <input value={draft[f.key] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder="https://…"
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

// ── Global Notice ─────────────────────────────────────────────────────────────
const NOTICE_TYPES = [
  { value: 'info',    label: '📢 普通通知' },
  { value: 'warning', label: '⚠️ 警告提示' },
  { value: 'success', label: '✅ 喜讯公告' },
]

function GlobalNoticeSection({ cfg }: { cfg: SystemConfig }) {
  const v = cfg.value
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [enabled, setEnabled] = useState(Boolean(v.enabled))
  const [text,    setText]    = useState(String(v.text ?? ''))
  const [type,    setType]    = useState(String(v.type ?? 'info'))

  async function save() {
    setSaving(true); setError(null)
    try { await patchConfig(cfg.key, { enabled, text: text.trim(), type }); setOpen(false) }
    catch { setError('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-stone-300'}`} />
            <span className="text-sm text-stone-700">{enabled ? '已开启' : '未开启'}</span>
          </div>
          {enabled && text && (
            <p className="text-xs text-stone-500 mt-1 leading-relaxed line-clamp-2">{text}</p>
          )}
          {!text && <p className="text-xs text-stone-400 mt-1">暂无公告内容</p>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>
      {open && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
          <Row label="是否启用">
            <div className="flex gap-2">
              {[{ v: true, l: '开启' }, { v: false, l: '关闭' }].map(o => (
                <button key={String(o.v)} type="button" onClick={() => setEnabled(o.v)}
                  className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors
                    ${enabled === o.v ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 text-stone-500 hover:bg-stone-100'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </Row>
          <Row label="公告内容">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="输入要显示给所有用户的公告…"
              className={`${inp} resize-none`} />
          </Row>
          <Row label="公告类型">
            <div className="flex flex-wrap gap-2">
              {NOTICE_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                    ${type === t.value ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 text-stone-500 hover:bg-stone-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </Row>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
              <>
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generic raw config ────────────────────────────────────────────────────────
const CN_LABELS: Record<string, string> = {
  cost_rates: 'AI 费率参考（每次对齐成本，USD）',
}

function RawSection({ cfg }: { cfg: SystemConfig }) {
  const [open,   setOpen]   = useState(false)
  const [raw,    setRaw]    = useState(JSON.stringify(cfg.value, null, 2))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function save() {
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(raw) } catch { setError('JSON 格式有误，请检查'); return }
    setSaving(true); setError(null)
    try { await patchConfig(cfg.key, parsed); setOpen(false) }
    catch { setError('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">{CN_LABELS[cfg.key] ?? cfg.key}</p>
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          <Pencil className="h-3 w-3" />{open ? '收起' : '编辑'}
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={5}
            className={`${inp} font-mono resize-none`} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : (
              <>
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
const EXCLUDED = ['ai_circuit_breaker', 'church_name']

export function FinanceCard({ configs }: { configs: SystemConfig[] }) {
  const donationCfg = configs.find(c => c.key === 'donation_settings')
  const paymentCfg  = configs.find(c => c.key === 'payment_links')
  const noticeCfg   = configs.find(c => c.key === 'global_notice')
  const otherCfgs   = configs.filter(c =>
    !['donation_settings', 'payment_links', 'global_notice', ...EXCLUDED].includes(c.key)
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <DollarSign className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="font-semibold text-foreground">奉献 & 系统配置</h2>
      </div>

      {noticeCfg && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">全局公告</p>
          <GlobalNoticeSection cfg={noticeCfg} />
        </div>
      )}

      {donationCfg && (
        <div className={noticeCfg ? 'pt-2 border-t border-stone-100' : ''}>
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
