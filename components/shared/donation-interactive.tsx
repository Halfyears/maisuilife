'use client'

import { useState } from 'react'
import { Copy, Check, ChevronRight, Loader2 } from 'lucide-react'

export interface PaymentConfig {
  zelle_account?:  string
  venmo_username?: string
  paypal_me?:      string
  wechat_qr_url?:  string
  alipay_qr_url?:  string
}

interface Appeal {
  title: string
  body:  string
}

interface Props {
  appeal:      Appeal | null
  usdAmounts:  number[]
  cnyAmounts:  number[]
  payment:     PaymentConfig
}

type Step = 'currency' | 'amount' | 'method' | 'guide' | 'done'
type Currency = 'USD' | 'CNY'

const USD_METHODS = [
  { key: 'zelle',      label: 'Zelle',  icon: '💜', bg: 'bg-[#6D1ED4]' },
  { key: 'venmo',      label: 'Venmo',  icon: '💙', bg: 'bg-[#3D95CE]' },
  { key: 'paypal',     label: 'PayPal', icon: '🔵', bg: 'bg-[#003087]' },
]
const CNY_METHODS = [
  { key: 'wechat_pay', label: '微信支付', icon: '💚', bg: 'bg-[#07C160]' },
  { key: 'alipay',     label: '支付宝',   icon: '🔷', bg: 'bg-[#1677FF]' },
]

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {})
    setOk(true); setTimeout(() => setOk(false), 2000)
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white
                 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600
                 hover:bg-stone-50 transition-colors active:scale-[0.97]">
      {ok ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {ok ? '已复制' : '复制'}
    </button>
  )
}

export function DonationInteractive({ appeal, usdAmounts, cnyAmounts, payment }: Props) {
  const hasUSD = !!(payment.zelle_account || payment.venmo_username || payment.paypal_me)
  const hasCNY = !!(payment.wechat_qr_url || payment.alipay_qr_url)
  const hasBoth = hasUSD && hasCNY

  const [step,       setStep]       = useState<Step>(hasBoth ? 'currency' : 'amount')
  const [curr,       setCurr]       = useState<Currency>(hasBoth ? 'USD' : hasCNY ? 'CNY' : 'USD')
  const [amount,     setAmount]     = useState<number | null>(null)
  const [custom,     setCustom]     = useState('')
  const [showCus,    setShowCus]    = useState(false)
  const [method,     setMethod]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const amounts = curr === 'CNY' ? cnyAmounts : usdAmounts
  const symbol  = curr === 'CNY' ? '¥' : '$'
  const methods = curr === 'CNY'
    ? CNY_METHODS.filter(m => m.key === 'wechat_pay' ? !!payment.wechat_qr_url : !!payment.alipay_qr_url)
    : USD_METHODS.filter(m =>
        m.key === 'zelle'  ? !!payment.zelle_account  :
        m.key === 'venmo'  ? !!payment.venmo_username :
        m.key === 'paypal' ? !!payment.paypal_me : false
      )

  function pickCurrency(c: Currency) {
    setCurr(c)
    setAmount(null); setCustom(''); setShowCus(false); setMethod(null)
    setStep('amount')
  }

  function pickAmount(a: number) {
    setAmount(a); setShowCus(false); setCustom('')
    if (methods.length === 1) { setMethod(methods[0].key); setStep('guide') }
    else setStep('method')
  }

  function confirmCustom() {
    const n = parseFloat(custom)
    if (n > 0) {
      setAmount(n)
      if (methods.length === 1) { setMethod(methods[0].key); setStep('guide') }
      else setStep('method')
    }
  }

  function pickMethod(key: string) {
    setMethod(key); setStep('guide')
  }

  function reset() {
    setStep(hasBoth ? 'currency' : 'amount')
    setAmount(null); setCustom(''); setShowCus(false); setMethod(null)
  }

  async function submitProof() {
    if (!method || !amount) return
    setSubmitting(true)
    try {
      await fetch('/api/payment/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: method, amount, currency: curr }),
      })
    } catch { /* silent — proof submission is best-effort */ }
    finally { setSubmitting(false); setStep('done') }
  }

  const m = [...USD_METHODS, ...CNY_METHODS].find(x => x.key === method)

  // ── Currency selection ──────────────────────────────────────────────────────
  if (step === 'currency') return (
    <Widget appeal={appeal} onReset={null}>
      <p className="text-[11px] text-stone-500 mb-2">请选择支付货币</p>
      <div className="flex gap-2">
        {hasUSD && (
          <button onClick={() => pickCurrency('USD')}
            className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5
                       text-xs font-bold text-stone-700 hover:border-stone-400
                       transition-all active:scale-[0.97]">
            🇺🇸 USD 美元
          </button>
        )}
        {hasCNY && (
          <button onClick={() => pickCurrency('CNY')}
            className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5
                       text-xs font-bold text-stone-700 hover:border-stone-400
                       transition-all active:scale-[0.97]">
            🇨🇳 CNY 人民币
          </button>
        )}
      </div>
    </Widget>
  )

  // ── Amount selection ────────────────────────────────────────────────────────
  if (step === 'amount') return (
    <Widget appeal={appeal} onReset={hasBoth ? reset : null}>
      <div className="flex flex-wrap gap-1.5">
        {amounts.map(a => (
          <button key={a} onClick={() => pickAmount(a)}
            className={[
              'rounded-full border px-3 py-1 text-[11px] font-semibold transition-all active:scale-[0.97]',
              amount === a
                ? 'bg-stone-800 border-stone-800 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50',
            ].join(' ')}>
            {symbol}{a}
          </button>
        ))}

        {!showCus ? (
          <button onClick={() => setShowCus(true)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1
                       text-[11px] font-semibold text-stone-500
                       hover:border-stone-400 hover:bg-stone-50
                       transition-all active:scale-[0.97]">
            自定义
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-stone-400">{symbol}</span>
            <input
              type="number" min="1" autoFocus
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmCustom()}
              placeholder="金额"
              className="w-16 rounded-full border border-stone-300 bg-white px-2 py-0.5
                         text-[11px] text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
            <button onClick={confirmCustom}
              disabled={!(parseFloat(custom) > 0)}
              className="rounded-full bg-stone-700 px-2.5 py-0.5 text-[11px] font-bold text-white
                         hover:bg-stone-900 disabled:opacity-40 transition-all">
              →
            </button>
          </div>
        )}
      </div>
    </Widget>
  )

  // ── Method selection ────────────────────────────────────────────────────────
  if (step === 'method') return (
    <Widget appeal={null} onReset={reset}>
      <p className="text-[11px] text-stone-500 mb-2">
        支持 <span className="font-bold text-stone-800">{symbol}{amount}</span>，请选择支付方式
      </p>
      <div className="space-y-1.5">
        {methods.map(mt => (
          <button key={mt.key} onClick={() => pickMethod(mt.key)}
            className="flex w-full items-center justify-between rounded-xl border border-stone-100
                       bg-white px-3.5 py-2.5 text-left hover:bg-stone-50
                       transition-all active:scale-[0.99]">
            <span className="flex items-center gap-2 text-xs font-bold text-stone-700">
              <span>{mt.icon}</span>{mt.label}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-stone-300" />
          </button>
        ))}
      </div>
    </Widget>
  )

  // ── Payment guide ───────────────────────────────────────────────────────────
  if (step === 'guide') return (
    <Widget appeal={null} onReset={reset}>
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold text-stone-600">
          {m?.icon} {m?.label} · {symbol}{amount}
        </p>

        {/* Zelle */}
        {method === 'zelle' && payment.zelle_account && (
          <>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              请打开您的银行 App，使用 Zelle 向以下账号转账：
            </p>
            <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
              <span className="text-xs font-bold text-stone-800">{payment.zelle_account}</span>
              <CopyBtn text={payment.zelle_account} />
            </div>
            <p className="text-[10px] text-stone-400">备注：麦穗同工支持</p>
          </>
        )}

        {/* Venmo */}
        {method === 'venmo' && payment.venmo_username && (
          <>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              点击跳转 Venmo，向 @{payment.venmo_username} 转账：
            </p>
            <a href={`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(payment.venmo_username)}&amount=${amount}&note=${encodeURIComponent('麦穗同工支持')}`}
              target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white
                          hover:opacity-90 active:scale-[0.98] ${m?.bg}`}>
              💙 打开 Venmo
            </a>
          </>
        )}

        {/* PayPal */}
        {method === 'paypal' && payment.paypal_me && (
          <>
            <p className="text-[11px] text-stone-500">点击跳转 PayPal 付款：</p>
            <a href={payment.paypal_me.includes('paypal.me')
                ? `${payment.paypal_me.replace(/\/$/, '')}/${amount}`
                : payment.paypal_me}
              target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white
                          hover:opacity-90 active:scale-[0.98] ${m?.bg}`}>
              🔵 打开 PayPal
            </a>
          </>
        )}

        {/* WeChat */}
        {method === 'wechat_pay' && payment.wechat_qr_url && (
          <>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              长按保存二维码，打开微信 → 扫一扫 → 从相册选取：
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={payment.wechat_qr_url} alt="微信收款码"
              className="mx-auto block w-36 h-36 rounded-xl border border-stone-100 object-contain" />
            <p className="text-center text-[10px] text-stone-400">长按图片 → 保存到相册</p>
          </>
        )}

        {/* Alipay */}
        {method === 'alipay' && payment.alipay_qr_url && (
          <>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              长按保存二维码，打开支付宝 → 扫一扫 → 从相册选取：
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={payment.alipay_qr_url} alt="支付宝收款码"
              className="mx-auto block w-36 h-36 rounded-xl border border-stone-100 object-contain" />
            <p className="text-center text-[10px] text-stone-400">长按图片 → 保存到相册</p>
          </>
        )}

        <button onClick={submitProof} disabled={submitting}
          className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-stone-100 bg-stone-50 py-2
                     text-[11px] font-semibold text-stone-500
                     hover:bg-stone-100 transition-colors active:scale-[0.98] disabled:opacity-60">
          {submitting
            ? <><Loader2 className="h-3 w-3 animate-spin" />提交中…</>
            : '完成，感谢支持 ✓'}
        </button>
      </div>
    </Widget>
  )

  // ── Done ────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3.5 text-center space-y-1">
      <p className="text-base">☕</p>
      <p className="text-[11px] font-bold text-stone-700">感谢你的支持，愿神纪念你的心意！</p>
      <button onClick={reset}
        className="mt-1 text-[10px] text-stone-400 hover:text-stone-600 transition-colors underline">
        再次支持
      </button>
    </div>
  )
}

// ── Shared wrapper ────────────────────────────────────────────────────────────
function Widget({
  appeal, onReset, children,
}: {
  appeal: Appeal | null
  onReset: (() => void) | null
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-stone-600">
            ☕ {appeal?.title ?? '请开发同工喝杯咖啡'}
          </p>
          {appeal?.body && (
            <p className="text-[10px] text-stone-400 leading-relaxed mt-0.5">{appeal.body}</p>
          )}
          {!appeal?.body && (
            <p className="text-[10px] text-stone-400 leading-relaxed mt-0.5">
              分担一点服务器与开发费用，感谢你的支持。
            </p>
          )}
        </div>
        {onReset && (
          <button onClick={onReset}
            className="shrink-0 text-[10px] text-stone-400 hover:text-stone-600 transition-colors">
            重选
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
