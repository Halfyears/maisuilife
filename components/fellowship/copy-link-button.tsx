'use client'

import { useState } from 'react'
import { Copy, Link2, Check } from 'lucide-react'

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

export function FellowshipInviteCard({ code }: { code: string }) {
  const [codeCopied,  setCodeCopied]  = useState(false)
  const [linkCopied, setLinkCopied]  = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch { /* ignore */ }
  }

  async function copyLink() {
    try {
      const url = `${window.location.origin}/fellowship/join?code=${code}`
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch { /* ignore */ }
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm">
      <p className="text-xs text-stone-400 mb-2">邀请弟兄姐妹加入团契</p>
      <p className="text-3xl font-black tracking-[0.3em] text-stone-900 mb-3">{code}</p>
      <div className="flex gap-2">
        <button
          onClick={copyCode}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200
                     py-2.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
        >
          {codeCopied
            ? <><Check className="h-3.5 w-3.5 text-green-500" />已复制</>
            : <><Copy className="h-3.5 w-3.5" />复制码</>}
        </button>
        <button
          onClick={copyLink}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200
                     bg-amber-50 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
        >
          {linkCopied
            ? <><Check className="h-3.5 w-3.5 text-green-500" />链接已复制</>
            : <><Link2 className="h-3.5 w-3.5" />复制链接</>}
        </button>
      </div>
    </div>
  )
}
