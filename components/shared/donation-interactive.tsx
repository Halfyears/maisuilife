'use client'

import { useState } from 'react'
import { Heart, ChevronDown } from 'lucide-react'

interface Appeal {
  title: string
  body:  string
}

interface PayLink {
  key:   string
  label: string
  href:  string
  color: string
  icon:  string
}

interface Props {
  appeal:   Appeal | null
  amounts:  number[]
  currency: string
  payLinks: PayLink[]
}

export function DonationInteractive({ appeal, amounts, currency, payLinks }: Props) {
  const [selected,   setSelected]   = useState<number | null>(null)
  const [custom,     setCustom]     = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showPay,    setShowPay]    = useState(false)

  const finalAmount = showCustom
    ? (parseFloat(custom) > 0 ? parseFloat(custom) : null)
    : selected

  function handleAmount(a: number) {
    setSelected(a)
    setShowCustom(false)
    setCustom('')
    setShowPay(true)
  }

  function handleCustomToggle() {
    setShowCustom(true)
    setSelected(null)
    setShowPay(false)
  }

  function handleCustomConfirm() {
    if (parseFloat(custom) > 0) setShowPay(true)
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/50 px-4 py-4 space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-sm font-bold text-stone-800">{appeal?.title ?? '感恩奉献'}</p>
      </div>

      {/* ── Appeal body ── */}
      {appeal?.body && (
        <p className="text-xs text-stone-500 leading-relaxed">{appeal.body}</p>
      )}

      {/* ── Amount buttons ── */}
      <div className="flex flex-wrap gap-2">
        {amounts.map(a => (
          <button
            key={a}
            onClick={() => handleAmount(a)}
            className={[
              'rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-[0.97]',
              selected === a && !showCustom
                ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50',
            ].join(' ')}
          >
            {currency} {a}
          </button>
        ))}

        {/* Custom amount */}
        {!showCustom ? (
          <button
            onClick={handleCustomToggle}
            className="rounded-full border border-amber-200 bg-white px-4 py-1.5
                       text-xs font-bold text-amber-700 hover:bg-amber-50 transition-all active:scale-[0.97]"
          >
            自定义
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-500 font-medium">{currency}</span>
            <input
              type="number"
              min="1"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="金额"
              className="w-20 rounded-full border border-amber-300 bg-white px-3 py-1.5
                         text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
              autoFocus
            />
            <button
              onClick={handleCustomConfirm}
              disabled={!(parseFloat(custom) > 0)}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white
                         hover:bg-amber-600 disabled:opacity-40 transition-all active:scale-[0.97]"
            >
              确定
            </button>
          </div>
        )}
      </div>

      {/* ── Payment section ── */}
      {showPay && finalAmount && payLinks.length > 0 && (
        <div className="pt-1 space-y-2 border-t border-amber-100">
          <div className="flex items-center gap-1.5">
            <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-stone-600">
              已选 {currency} {finalAmount}，请选择支付方式
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {payLinks.map(p => (
              <a
                key={p.key}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'flex items-center gap-2 rounded-xl px-4 py-2.5',
                  'text-xs font-bold text-white shadow-sm transition-all',
                  'hover:opacity-90 active:scale-[0.97]',
                  p.color,
                ].join(' ')}
              >
                <span className="text-base leading-none">{p.icon}</span>
                {p.label}
              </a>
            ))}
          </div>
          <p className="text-[10px] text-stone-400 leading-relaxed">
            点击后将跳转至对应支付页面。感谢你的爱心奉献，愿神纪念。🙏
          </p>
        </div>
      )}

      {showPay && finalAmount && payLinks.length === 0 && (
        <p className="text-xs text-stone-400 pt-1 border-t border-amber-100">
          支付方式配置中，请联系管理员获取奉献方式。
        </p>
      )}
    </div>
  )
}
