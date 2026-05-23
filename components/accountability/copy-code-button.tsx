'use client'

import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200
                 py-2.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : '复制码'}
    </button>
  )
}

interface CopyLinkButtonProps {
  code:     string
  name?:    string   // 小组名称（用于邀请文案）
  isVigil?: boolean  // 守望相助 vs 同行小组
}

export function CopyLinkButton({ code, name, isVigil = false }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const url = `${window.location.origin}/accountability/join?code=${code}`
      const emoji     = isVigil ? '🕊️' : '🌿'
      const typeLabel = isVigil ? '守望相助' : '同行小组'
      const nameStr   = name ? `「${name}」` : ''
      const message = [
        `我在「麦穗喜乐」等你 ${emoji}`,
        '',
        `诚邀你加入${typeLabel}${nameStr}，${
          isVigil ? '同心守望、彼此扶持。' : '彼此激励、一起迈向目标。'
        }`,
        '',
        `▶ 邀请码：${code}`,
        `▶ 直接加入：${url}`,
      ].join('\n')

      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200
                 bg-amber-50 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? '邀请已复制' : '复制邀请'}
    </button>
  )
}
