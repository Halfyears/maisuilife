'use client'

import { useState } from 'react'
import { Monitor, Copy, Check, ExternalLink, Tv } from 'lucide-react'

const CAST_METHODS = [
  {
    icon: '💻',
    title: 'HDMI 连线（推荐）',
    desc: '笔记本接 HDMI 到电视 → 电视切换输入源 → 浏览器打开网址 → F11 全屏',
  },
  {
    icon: '📡',
    title: 'Chromecast 无线',
    desc: 'Chromecast 插电视 HDMI 口 → 电脑 Chrome 打开网址 → 右上角"投射"→ 选设备',
  },
  {
    icon: '📱',
    title: '手机镜像',
    desc: '安卓：投屏 / 无线显示 → 智能电视\niPhone：控制中心 AirPlay 镜像 → Apple TV 或兼容电视',
  },
  {
    icon: '📺',
    title: '智能电视浏览器',
    desc: '部分智能电视内置浏览器，直接输入网址即可。注意：渲染可能较慢。',
  },
]

interface Props {
  inviteCode: string
  fellowshipId: string
}

export function ProjectorLaunchCard({ inviteCode, fellowshipId }: Props) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen]     = useState(false)

  const shortUrl  = `maisuijoy.com/p/${inviteCode}`
  const fullUrl   = `https://www.maisuijoy.com/p/${inviteCode}`
  const localUrl  = `/fellowship/console/projector?fellowship_id=${fellowshipId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-4 shadow-sm">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100">
          <Tv className="h-4 w-4 text-stone-600" />
        </div>
        <h3 className="text-sm font-bold text-stone-900">投屏到电视</h3>
      </div>

      {/* ── 短网址 ────────────────────────────────────── */}
      <p className="text-xs text-stone-400 mb-1.5">在电视/大屏浏览器输入此网址：</p>
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
        <Monitor className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="flex-1 font-mono text-sm font-semibold text-stone-800 tracking-wide">
          {shortUrl}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="复制链接"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-amber-600
                     hover:bg-amber-100 transition-colors"
        >
          {copied
            ? <><Check className="h-3.5 w-3.5" /> 已复制</>
            : <><Copy className="h-3.5 w-3.5" /> 复制</>
          }
        </button>
      </div>

      {/* ── 本机直接打开 ──────────────────────────────── */}
      <a
        href={localUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-xl
                   border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600
                   hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        在本机新标签页打开投屏
      </a>

      {/* ── 投屏方式说明（折叠）────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="mt-3 w-full text-left text-xs text-stone-400 hover:text-stone-600
                   flex items-center justify-between transition-colors"
      >
        <span>投屏到电视的方式</span>
        <span className="text-[10px]">{open ? '▲ 收起' : '▼ 展开'}</span>
      </button>

      {open && (
        <ul className="mt-3 flex flex-col gap-3">
          {CAST_METHODS.map((m) => (
            <li key={m.title} className="flex gap-2.5">
              <span className="mt-0.5 text-base leading-none shrink-0">{m.icon}</span>
              <div>
                <p className="text-xs font-semibold text-stone-700">{m.title}</p>
                <p className="mt-0.5 text-[11px] text-stone-400 leading-relaxed whitespace-pre-line">
                  {m.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
