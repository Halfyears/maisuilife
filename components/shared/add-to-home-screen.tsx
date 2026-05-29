'use client'

import { useEffect, useState } from 'react'
import { Wheat, Share, MoreVertical, PlusSquare } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────
// 平台检测
// ─────────────────────────────────────────────────────────────────
type Platform = 'ios' | 'android' | 'wechat' | null

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/MicroMessenger/i.test(ua))         return 'wechat'   // 微信内置浏览器
  if (/iphone|ipad|ipod/i.test(ua))       return 'ios'
  if (/android/i.test(ua))                return 'android'
  return null
}

/** 是否已在独立 PWA 模式运行（已安装到主屏幕） */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    // iOS Safari 专有属性优先
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true
    // 现代浏览器 matchMedia
    return window.matchMedia?.('(display-mode: standalone)')?.matches ?? false
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────
// 导出：触发判断工具函数（供外部调用）
// ─────────────────────────────────────────────────────────────────
export function shouldShowA2HS(): boolean {
  if (typeof window === 'undefined') return false
  if (isStandalone()) return false                           // 已安装，不再提示
  if (localStorage.getItem('a2hs_shown')) return false      // 已提示过
  return !!detectPlatform()                                  // 移动端才提示
}

export function markA2HSShown(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('a2hs_shown', '1')
  }
}

// ─────────────────────────────────────────────────────────────────
// 步骤条目
// ─────────────────────────────────────────────────────────────────
function Step({
  num,
  icon,
  title,
  desc,
}: {
  num: number
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-amber-50/70 border border-amber-100/60 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                      bg-gradient-to-br from-amber-400 to-orange-400 text-xs font-black text-white shadow-sm">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-amber-500">{icon}</span>
          <p className="text-sm font-bold text-stone-800">{title}</p>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void
}

export function AddToHomeScreen({ onClose }: Props) {
  const [platform, setPlatform] = useState<Platform>(null)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    const p = detectPlatform()
    setPlatform(p)
    if (p) {
      // 微帧延迟触发入场动画
      const t = setTimeout(() => setVisible(true), 30)
      return () => clearTimeout(t)
    }
  }, [])

  // 弹窗显示时锁定背景滚动
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [visible])

  if (!platform) return null

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  // ── 微信：不支持添加主屏幕，引导用其他浏览器打开 ──────────────
  if (platform === 'wechat') {
    return (
      <Backdrop visible={visible} onDismiss={handleClose}>
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 shadow-sm">
            <Wheat className="h-7 w-7 text-amber-500" />
          </div>
          <h2 className="font-serif text-lg font-bold text-stone-900 tracking-wide">添加到主屏幕</h2>
          <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
            像 App 一样快速打开麦穗喜乐，随时与祂同行
          </p>
        </div>

        <div className="rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-4 mb-5">
          <p className="text-sm font-bold text-orange-700 mb-1.5">📱 请用浏览器打开</p>
          <p className="text-xs text-stone-600 leading-relaxed">
            微信内置浏览器不支持添加到主屏幕。<br />
            请点击右上角「⋯」→「在浏览器中打开」，<br />
            然后再按提示添加到主屏幕。
          </p>
        </div>

        <CloseButton onClose={handleClose} />
      </Backdrop>
    )
  }

  // ── iOS（Safari）──────────────────────────────────────────────
  if (platform === 'ios') {
    return (
      <Backdrop visible={visible} onDismiss={handleClose}>
        <Header />
        <div className="space-y-2.5 mb-5">
          <Step
            num={1}
            icon={<Share className="h-3.5 w-3.5" />}
            title="点击底部分享按钮"
            desc="Safari 底部工具栏中间的「↑」分享图标"
          />
          <Step
            num={2}
            icon={<PlusSquare className="h-3.5 w-3.5" />}
            title='选择"添加到主屏幕"'
            desc="在弹出菜单中向下滑动，找到该选项"
          />
          <Step
            num={3}
            icon={<Wheat className="h-3.5 w-3.5" />}
            title='点击右上角"添加"'
            desc="麦穗喜乐图标将出现在您的主屏幕上"
          />
        </div>
        <CloseButton onClose={handleClose} />
      </Backdrop>
    )
  }

  // ── Android（Chrome）─────────────────────────────────────────
  return (
    <Backdrop visible={visible} onDismiss={handleClose}>
      <Header />
      <div className="space-y-2.5 mb-5">
        <Step
          num={1}
          icon={<MoreVertical className="h-3.5 w-3.5" />}
          title="点击右上角菜单"
          desc="Chrome 右上角的「⋮」三点菜单"
        />
        <Step
          num={2}
          icon={<PlusSquare className="h-3.5 w-3.5" />}
          title='选择"添加到主屏幕"'
          desc='部分机型显示为"安装应用"'
        />
        <Step
          num={3}
          icon={<Wheat className="h-3.5 w-3.5" />}
          title="确认添加"
          desc='点击弹窗中的"添加"即完成安装'
        />
      </div>
      <CloseButton onClose={handleClose} />
    </Backdrop>
  )
}

// ─────────────────────────────────────────────────────────────────
// 子组件
// ─────────────────────────────────────────────────────────────────
function Backdrop({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean
  onDismiss: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-end justify-center px-4 transition-colors duration-300',
        visible ? 'bg-black/50' : 'bg-black/0',
      ].join(' ')}
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
      role="dialog"
      aria-modal="true"
      aria-label="添加到主屏幕引导"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={[
          'w-full max-w-sm rounded-t-3xl border-t border-x border-stone-100/80',
          'bg-white/95 p-6 shadow-2xl shadow-stone-900/20 backdrop-blur-xl',
          'transition-all duration-300',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0',
        ].join(' ')}
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 1rem), 1.5rem)' }}
      >
        {children}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="text-center mb-5">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50
                      shadow-sm shadow-amber-200/50">
        <Wheat className="h-7 w-7 text-amber-500" />
      </div>
      <h2 className="font-serif text-lg font-bold text-stone-900 tracking-wide">添加到主屏幕</h2>
      <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
        像 App 一样快速打开麦穗喜乐，随时与祂同行
      </p>
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="w-full rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600
                 py-3.5 text-sm font-bold tracking-wide text-white
                 shadow-md shadow-amber-500/25 transition-all
                 hover:opacity-90 active:scale-[0.98]"
    >
      我知道了，开始同行 🌾
    </button>
  )
}
