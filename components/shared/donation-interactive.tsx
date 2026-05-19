'use client'

import { useState } from 'react'
import { Copy, Check, ChevronRight, X } from 'lucide-react'

export interface PaymentConfig {
  zelle_account?: string   // email or phone to display + copy
  venmo_username?: string  // for deep link
  paypal_me?: string       // paypal.me URL
  wechat_qr_url?: string   // QR code image URL
  alipay_qr_url?: string   // QR code image URL
}

interface Appeal {
  title: string
  body:  string
}

interface Props {
  appeal:   Appeal | null
  amounts:  number[]
  currency: string
  payment:  PaymentConfig
}

type Step = 'amount' | 'method' | 'guide' | 'proof' | 'done'

const METHODS = [
  { key: 'zelle',      label: 'Zelle',    icon: '💜', color: 'border-purple-100 bg-purple-50/60 text-purple-800' },
  { key: 'venmo',      label: 'Venmo',    icon: '💙', color: 'border-blue-100 bg-blue-50/60 text-blue-800'     },
  { key: 'paypal',     label: 'PayPal',   icon: '🔵', color: 'border-indigo-100 bg-indigo-50/60 text-indigo-800' },
  { key: 'wechat_pay', label: '微信支付', icon: '💚', color: 'border-green-100 bg-green-50/60 text-green-800'  },
  { key: 'alipay',     label: '支付宝',   icon: '🔷', color: 'border-sky-100 bg-sky-50/60 text-sky-800'       },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function doCopy() {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={doCopy}
      className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white
                 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600
                 hover:bg-stone-50 transition-colors active:scale-[0.97]">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? '已复制' : '复制'}
    </button>
  )
}

export function DonationInteractive({ appeal, amounts, currency, payment }: Props) {
  const [step,         setStep]        = useState<Step>('amount')
  const [finalAmount,  setFinalAmount] = useState<number | null>(null)
  const [customInput,  setCustomInput] = useState('')
  const [showCustom,   setShowCustom]  = useState(false)
  const [activeMethod, setMethod]      = useState<string | null>(null)
  const [memo,         setMemo]        = useState('')
  const [submitting,   setSubmitting]  = useState(false)
  const [submitErr,    setSubmitErr]   = useState<string | null>(null)

  // Which methods are configured?
  const availableMethods = METHODS.filter(m => {
    if (m.key === 'zelle')      return !!payment.zelle_account
    if (m.key === 'venmo')      return !!payment.venmo_username
    if (m.key === 'paypal')     return !!payment.paypal_me
    if (m.key === 'wechat_pay') return !!payment.wechat_qr_url
    if (m.key === 'alipay')     return !!payment.alipay_qr_url
    return false
  })

  function pickAmount(a: number) {
    setFinalAmount(a)
    setShowCustom(false)
    setCustomInput('')
    setStep(availableMethods.length ? 'method' : 'proof')
  }

  function confirmCustom() {
    const n = parseFloat(customInput)
    if (n > 0) {
      setFinalAmount(n)
      setStep(availableMethods.length ? 'method' : 'proof')
    }
  }

  function pickMethod(key: string) {
    setMethod(key)
    setStep('guide')
  }

  async function submitProof() {
    if (!finalAmount || !activeMethod) return
    setSubmitting(true); setSubmitErr(null)
    try {
      const res = await fetch('/api/payment/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: activeMethod, amount: finalAmount, currency, memo: memo.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        if (d.error === 'too_many_pending') {
          setSubmitErr('您已有待审核记录，请等待审核后再提交')
        } else {
          setSubmitErr('提交失败，请重试')
        }
        return
      }
      setStep('done')
    } catch { setSubmitErr('网络错误，请重试') }
    finally  { setSubmitting(false) }
  }

  function reset() {
    setStep('amount'); setFinalAmount(null); setCustomInput(''); setShowCustom(false)
    setMethod(null); setMemo(''); setSubmitErr(null)
  }

  const method = METHODS.find(m => m.key === activeMethod)

  // ── Step: amount selection ──────────────────────────────────────────────────
  if (step === 'amount') return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3.5 space-y-2.5">
      {appeal && (
        <div>
          <p className="text-[11px] font-bold text-stone-600">{appeal.title}</p>
          <p className="text-[11px] text-stone-400 leading-relaxed mt-0.5">{appeal.body}</p>
        </div>
      )}
      {!appeal && <p className="text-[11px] font-bold text-stone-500">感恩奉献</p>}

      <div className="flex flex-wrap gap-1.5">
        {amounts.map(a => (
          <button key={a} onClick={() => pickAmount(a)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1
                       text-[11px] font-semibold text-stone-600
                       hover:border-stone-400 hover:bg-stone-100
                       transition-all active:scale-[0.97]">
            {currency} {a}
          </button>
        ))}

        {!showCustom ? (
          <button onClick={() => setShowCustom(true)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1
                       text-[11px] font-semibold text-stone-500
                       hover:border-stone-400 hover:bg-stone-100
                       transition-all active:scale-[0.97]">
            自定义
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-stone-400">{currency}</span>
            <input
              type="number" min="1" autoFocus
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmCustom()}
              placeholder="金额"
              className="w-16 rounded-full border border-stone-300 bg-white px-2 py-0.5
                         text-[11px] text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
            <button onClick={confirmCustom}
              disabled={!(parseFloat(customInput) > 0)}
              className="rounded-full bg-stone-700 px-2.5 py-0.5 text-[11px] font-bold text-white
                         hover:bg-stone-800 disabled:opacity-40 transition-all active:scale-[0.97]">
              →
            </button>
            <button onClick={() => { setShowCustom(false); setCustomInput('') }}
              className="text-stone-400 hover:text-stone-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── Step: payment method selection ─────────────────────────────────────────
  if (step === 'method') return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-stone-600">
          奉献金额 <span className="text-stone-900">{currency} {finalAmount}</span>，选择支付方式
        </p>
        <button onClick={reset} className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors">
          重选
        </button>
      </div>

      <div className="space-y-1.5">
        {availableMethods.map(m => (
          <button key={m.key} onClick={() => pickMethod(m.key)}
            className={[
              'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5',
              'text-left transition-all active:scale-[0.99]',
              m.color,
            ].join(' ')}>
            <span className="flex items-center gap-2 text-xs font-bold">
              <span className="text-sm">{m.icon}</span>{m.label}
            </span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          </button>
        ))}

        {availableMethods.length === 0 && (
          <p className="text-[11px] text-stone-400">支付方式配置中，请联系管理员。</p>
        )}
      </div>
    </div>
  )

  // ── Step: payment guide (method-specific) ──────────────────────────────────
  if (step === 'guide') return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-stone-600">
          {method?.icon} {method?.label} · {currency} {finalAmount}
        </p>
        <button onClick={() => setStep('method')}
          className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors">
          返回
        </button>
      </div>

      {/* Zelle */}
      {activeMethod === 'zelle' && payment.zelle_account && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            请打开您的银行 App（如 Chase / Bank of America），使用 Zelle 向以下账号转账：
          </p>
          <div className="flex items-center justify-between rounded-lg border border-purple-100 bg-white px-3 py-2">
            <span className="text-xs font-bold text-stone-800">{payment.zelle_account}</span>
            <CopyButton text={payment.zelle_account} />
          </div>
          <p className="text-[10px] text-stone-400">转账备注请填写：麦穗奉献 {currency} {finalAmount}</p>
        </div>
      )}

      {/* Venmo */}
      {activeMethod === 'venmo' && payment.venmo_username && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            点击下方按钮将跳转至 Venmo，请向 @{payment.venmo_username} 转账：
          </p>
          <a
            href={`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(payment.venmo_username)}&amount=${finalAmount}&note=${encodeURIComponent(`麦穗奉献`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#3D95CE]
                       py-2.5 text-xs font-bold text-white hover:opacity-90 transition-opacity active:scale-[0.98]">
            💙 打开 Venmo 转账
          </a>
          <p className="text-[10px] text-stone-400">如 Venmo 未安装，请在应用商店下载后再操作。</p>
        </div>
      )}

      {/* PayPal */}
      {activeMethod === 'paypal' && payment.paypal_me && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            点击下方按钮将跳转至 PayPal 支付页面：
          </p>
          <a
            href={payment.paypal_me.includes('paypal.me')
              ? `${payment.paypal_me.replace(/\/$/, '')}/${finalAmount}`
              : payment.paypal_me}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#003087]
                       py-2.5 text-xs font-bold text-white hover:opacity-90 transition-opacity active:scale-[0.98]">
            🔵 打开 PayPal 付款
          </a>
        </div>
      )}

      {/* WeChat QR */}
      {activeMethod === 'wechat_pay' && payment.wechat_qr_url && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            长按保存二维码到相册，打开微信→扫一扫→从相册选取，完成转账：
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payment.wechat_qr_url} alt="微信收款码"
            className="mx-auto block w-36 h-36 rounded-xl border border-stone-100 object-contain" />
          <p className="text-center text-[10px] text-stone-400">长按图片保存到相册</p>
        </div>
      )}

      {/* Alipay QR */}
      {activeMethod === 'alipay' && payment.alipay_qr_url && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            长按保存二维码到相册，打开支付宝→扫一扫→从相册选取，完成转账：
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payment.alipay_qr_url} alt="支付宝收款码"
            className="mx-auto block w-36 h-36 rounded-xl border border-stone-100 object-contain" />
          <p className="text-center text-[10px] text-stone-400">长按图片保存到相册</p>
        </div>
      )}

      <button onClick={() => setStep('proof')}
        className="w-full rounded-xl border border-stone-200 bg-white py-2 text-[11px]
                   font-semibold text-stone-600 hover:bg-stone-100 transition-colors active:scale-[0.98]">
        我已完成转账 →
      </button>
    </div>
  )

  // ── Step: submit proof memo ─────────────────────────────────────────────────
  if (step === 'proof') return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3.5 space-y-2.5">
      <p className="text-[11px] font-bold text-stone-600">提交奉献记录</p>
      <p className="text-[11px] text-stone-400 leading-relaxed">
        请填写转账备注（如转账人姓名、尾号等），方便管理员核对：
      </p>
      <textarea
        value={memo}
        onChange={e => setMemo(e.target.value)}
        rows={2}
        placeholder="例：转账人 王弟兄，尾号 1234"
        className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2
                   text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
      />
      {submitErr && <p className="text-[11px] text-red-500">{submitErr}</p>}
      <div className="flex gap-2">
        <button onClick={submitProof} disabled={submitting}
          className="flex-1 rounded-xl bg-stone-800 py-2 text-xs font-bold text-white
                     hover:bg-stone-900 disabled:opacity-50 transition-colors active:scale-[0.98]">
          {submitting ? '提交中…' : '提交凭证'}
        </button>
        <button onClick={() => setStep('guide')}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2
                     text-xs text-stone-500 hover:bg-stone-100 transition-colors">
          返回
        </button>
      </div>
    </div>
  )

  // ── Step: done ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-green-100 bg-green-50/50 px-4 py-3.5 text-center space-y-1">
      <p className="text-sm">🙏</p>
      <p className="text-[11px] font-bold text-green-800">感谢您的奉献，愿神纪念您的爱心！</p>
      <p className="text-[10px] text-green-600">管理员将在核实转账后确认记录。</p>
      <button onClick={reset}
        className="mt-2 text-[10px] text-stone-400 hover:text-stone-600 transition-colors underline">
        重新奉献
      </button>
    </div>
  )
}
