import { redirect } from 'next/navigation'
import { Settings, User, ShieldCheck, Wheat } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { SignOutButton } from '@/components/shared/sign-out-button'

export const metadata = { title: '设置中心 — 麦穗喜乐' }
export const revalidate = 0

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: profile } = await db
    .from('users')
    .select('display_name, role, created_at')
    .eq('id', user.id)
    .single()

  const { data: membership } = await db
    .from('fellowship_members')
    .select('fellowship_id, fellowships(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const roleLabel: Record<string, string> = {
    member:      '普通成员',
    leader:      '团契组长',
    super_admin: '系统管理员',
  }

  const joinedYear = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : null

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Settings className="h-4 w-4 text-stone-500" />
          <h1 className="text-sm font-bold text-stone-900">设置中心</h1>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32 space-y-4">

        {/* ── Brand identity card ──────────────────── */}
        <div className="flex items-center gap-3 rounded-2xl border border-amber-100/60
                        bg-gradient-to-r from-amber-50/80 to-orange-50/50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Wheat className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900">麦穗喜乐</p>
            <p className="text-xs font-medium text-stone-500">属灵陪伴，同行成长</p>
          </div>
        </div>

        {/* ── User profile card ────────────────────── */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-5 border-b border-stone-100">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full
                            bg-gradient-to-br from-amber-100 to-orange-100 text-xl">
              {profile?.display_name?.slice(0, 1) ?? '?'}
            </div>
            <div>
              <p className="text-base font-bold text-stone-900">
                {profile?.display_name ?? '—'}
              </p>
              <p className="text-xs font-medium text-stone-500">{user.email}</p>
            </div>
          </div>

          {[
            { Icon: User,        label: '身份角色', value: roleLabel[profile?.role ?? 'member'] ?? profile?.role ?? '—' },
            { Icon: ShieldCheck, label: '所属团契', value: (membership?.fellowships as {name?: string} | null)?.name ?? '暂未加入' },
            { Icon: Wheat,       label: '加入年份', value: joinedYear ? `${joinedYear} 年` : '—' },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50 last:border-0">
              <Icon className="h-4 w-4 text-stone-300 shrink-0" />
              <span className="text-xs font-medium text-stone-400 w-20 shrink-0">{label}</span>
              <span className="text-sm font-medium text-stone-700">{value}</span>
            </div>
          ))}
        </div>

        {/* ── Admin shortcut ─────────────────────────── */}
        {profile?.role === 'super_admin' && (
          <a href="/admin/hub"
            className="flex items-center justify-between rounded-2xl border border-stone-100
                       bg-white/90 px-5 py-4 shadow-md shadow-amber-900/5 backdrop-blur-md
                       hover:border-amber-200 transition-colors">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-stone-900">管理中枢</span>
            </div>
            <span className="text-xs font-medium text-stone-400">→</span>
          </a>
        )}

        {/* ── Sign out ────────────────────────────────── */}
        <SignOutButton />

        <p className="text-center text-[11px] text-stone-300 pb-2">
          麦穗喜乐 · 属灵陪伴，同行成长
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
