'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sprout, Users, Target, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/daily',          Icon: Sprout,    label: '内室记录' },
  { href: '/fellowship',     Icon: Users,     label: '麦穗团契' },
  { href: '/accountability', Icon: Target,    label: '同行小组' },
  { href: '/growth',         Icon: BarChart2, label: '灵命成长' },
  { href: '/settings',       Icon: Settings,  label: '设置中心' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-100
                 bg-white/95 backdrop-blur-md"
      /* safe-area-inset-bottom 兼容 iOS 刘海屏；max(…, 8px) 保证非 iOS 也有最小内边距 */
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div className="flex w-full justify-center">
        {/* 固定 max-w-md 居中，避免宽屏下过度拉伸 */}
        <div className="flex w-full max-w-md items-center px-1 pt-2 pb-0.5">
          {TABS.map(({ href, Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center gap-[3px] py-1 min-w-0 transition-colors"
              >
                {/* 图标容器：固定 px 尺寸，避免 html font-size:18px 导致 rem 值膨胀 */}
                <div className={cn(
                  'flex items-center justify-center rounded-[14px] transition-all duration-200',
                  'h-[40px] w-[40px]',
                  active ? 'bg-amber-100' : 'bg-transparent',
                )}>
                  <Icon
                    /* 图标本身也用固定 px，视觉尺寸一致 */
                    style={{ width: 22, height: 22 }}
                    className={cn(active ? 'text-amber-600' : 'text-stone-400')}
                    strokeWidth={active ? 2.2 : 1.7}
                  />
                </div>
                {/* 标签：固定 10px，不受 rem / elder-mode 影响，4字也不会换行 */}
                <span
                  style={{ fontSize: 10 }}
                  className={cn(
                    'leading-none whitespace-nowrap font-medium',
                    active ? 'text-amber-600' : 'text-stone-400',
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
