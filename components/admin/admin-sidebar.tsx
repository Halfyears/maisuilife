'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CloudLightning, Settings, Users,
  Wheat, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin/hub',     label: '驾驶舱',   icon: LayoutDashboard },
  { href: '/admin/users',   label: '用户管理', icon: Users },
  { href: '/admin/config',  label: '系统配置', icon: Settings },
] as const

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <Wheat className="h-5 w-5 text-gold-500" />
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">麦穗喜乐</p>
          <p className="text-[10px] text-muted-foreground leading-tight uppercase tracking-wide">
            Admin Hub
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-gold-400/15 text-gold-700 font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Circuit breaker shortcut */}
        <div className="pt-3 mt-3 border-t border-border">
          <Link
            href="#circuit-breaker"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive/80 hover:bg-destructive/8 hover:text-destructive transition-colors"
          >
            <CloudLightning className="h-4 w-4 shrink-0" />
            AI 熔断开关
          </Link>
        </div>
      </nav>

      {/* Admin identity + sign-out */}
      <div className="border-t border-border p-3">
        <div className="mb-2 px-2">
          <p className="text-xs text-muted-foreground truncate">{adminName}</p>
          <p className="text-[10px] text-muted-foreground/60">super_admin</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
