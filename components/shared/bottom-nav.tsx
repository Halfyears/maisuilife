'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sprout, Users, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/daily',      Icon: Sprout,    label: '内室记录' },
  { href: '/fellowship', Icon: Users,     label: '麦穗团契' },
  { href: '/growth',     Icon: BarChart2, label: '灵命成长' },
  { href: '/settings',   Icon: Settings,  label: '设置中心' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-100
                 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 4px)' }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-2 pt-2 pb-1">
        {TABS.map(({ href, Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors"
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
                active ? 'bg-amber-100' : 'bg-transparent',
              )}>
                <Icon
                  className={cn('h-5 w-5', active ? 'text-amber-600' : 'text-stone-400')}
                  strokeWidth={active ? 2.2 : 1.7}
                />
              </div>
              <span className={cn(
                'text-[10px] font-medium leading-none',
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
