'use client'

import { useState } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'

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
      className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2
                 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : '复制码'}
    </button>
  )
}

export function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const url = `${window.location.origin}/accountability/join?code=${code}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2
                 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? '链接已复制' : '复制链接'}
    </button>
  )
}
