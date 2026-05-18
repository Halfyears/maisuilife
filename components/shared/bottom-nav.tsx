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
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-1 pt-2 pb-1">
        {TABS.map(({ href, Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-1.5 transition-colors"
            >
              <div className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200',
                active ? 'bg-amber-100' : 'bg-transparent',
              )}>
                <Icon
                  className={cn('h-6 w-6', active ? 'text-amber-600' : 'text-stone-400')}
                  strokeWidth={active ? 2.2 : 1.7}
                />
              </div>
              <span className={cn(
                'text-[11px] font-medium leading-none',
                active ? 'text-amber-600' : 'text-stone-400',
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
