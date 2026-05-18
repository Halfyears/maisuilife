'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

export function CopyLinkButton({ invitePath, label }: { invitePath: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const url = `${window.location.origin}${invitePath}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50
                 px-3 py-1.5 text-xs font-medium text-amber-700
                 hover:bg-amber-100 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? '已复制' : label}
    </button>
  )
}
