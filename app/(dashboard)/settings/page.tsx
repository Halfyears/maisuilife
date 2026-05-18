import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, Wheat, ShieldCheck, Users, BookOpen, Key, LogIn, Church, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { SignOutButton } from '@/components/shared/sign-out-button'
import { ProfileCard } from '@/components/settings/profile-card'

export const metadata = { title: '设置中心 — 麦穗喜乐' }
export const revalidate = 0

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  super_admin: {
    label: '⚡ 超级管理员',
    className: 'bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-xs px-3 py-1 rounded-full',
  },
  church_admin: {
    label: '⛪ 教会管理员',
    className: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-xs px-3 py-1 rounded-full',
  },
  group_leader: {
    label: '🌱 团契组长',
    className: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-xs px-3 py-1 rounded-full',
  },
}

const DEFAULT_BADGE = {
  label: '🌾 麦穗信徒',
  className: 'bg-gradient-to-r from-stone-400 to-stone-500 text-white font-bold text-xs px-3 py-1 rounded-full',
}

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const [profileRes, membershipRes] = await Promise.all([
    supabase
      .from('users')
      .select('display_name, role, created_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('fellowship_members')
      .select('fellowship_id, fellowships(name)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  const profile    = profileRes.data
  const membership = membershipRes.data
  const role       = profile?.role ?? 'user'
  const badge      = ROLE_BADGE[role] ?? DEFAULT_BADGE
  const joinedYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null
  const fellowship = (membership?.fellowships as { name?: string } | null)?.name

  return (
    <div className="flex min-h-dvh flex-col">

      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Settings className="h-4 w-4 text-stone-500" />
          <h1 className="text-sm font-bold text-stone-900">设置中心</h1>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                       px-3 py-1.5 text-xs font-medium text-stone-500
                       hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            首页
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-6 pb-32 space-y-4">

        {/* ── 品牌标识条 ──────────────────────────────────── */}
        <div className="flex items-center gap-3 rounded-2xl border border-amber-100/60
                        bg-gradient-to-r from-amber-50/80 to-orange-50/50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Wheat className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-black tracking-wide bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              麦穗喜乐
            </p>
            <p className="text-xs font-medium text-stone-500">MaisuiJoy · 平安喜乐</p>
          </div>
        </div>

        {/* ── 个人名片（可编辑）──────────────────────────── */}
        <ProfileCard
          initialName={profile?.display_name ?? ''}
          email={user.email ?? ''}
          badge={badge}
          joinedYear={joinedYear}
          fellowship={fellowship ?? null}
        />

        {/* ── 角色专属管理中枢 ─────────────────────────── */}
        <RolePanel role={role} fellowship={fellowship} />

        {/* ── 安全退出 ────────────────────────────────────── */}
        <SignOutButton />

        <p className="text-center text-[11px] text-stone-300 pb-2">
          麦穗喜乐 · MaisuiJoy · 平安喜乐
        </p>
      </main>

      <BottomNav />
    </div>
  )
}

// ── 角色专属管理面板 ─────────────────────────────────────────
function RolePanel({ role, fellowship }: { role: string; fellowship?: string | null }) {

  if (role === 'super_admin') {
    return (
      <div className="space-y-3">
        {/* 系统后台 */}
        <a href="/admin/hub"
          className="block rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/80 to-orange-50/60
                     px-6 py-5 shadow-md shadow-red-900/5 transition-all hover:border-red-200 active:scale-[0.99]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-red-500" />
              <span className="text-base font-black text-stone-900">⚡ 系统管理后台</span>
            </div>
            <span className="text-xs text-stone-400">进入 →</span>
          </div>
          <div className="space-y-1.5">
            {['AI 费率与成本监控', 'AI 熔断开关控制', '系统配置与全局设置'].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </a>
        {/* 教会管理 */}
        <a href="/church/hub"
          className="block rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-purple-50/60
                     px-6 py-5 shadow-md shadow-violet-900/5 transition-all hover:border-violet-200 active:scale-[0.99]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Church className="h-5 w-5 text-violet-500" />
              <span className="text-base font-black text-stone-900">⛪ 教会管理中枢</span>
            </div>
            <span className="text-xs text-stone-400">进入 →</span>
          </div>
          <div className="space-y-1.5">
            {['审核与批准团契申请', '团契及用户总览表', '教会数据统计'].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </a>
      </div>
    )
  }

  if (role === 'church_admin') {
    return (
      <a href="/church/hub"
        className="block rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-purple-50/60
                   px-6 py-5 shadow-md shadow-violet-900/5 transition-all hover:border-violet-200 active:scale-[0.99]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Church className="h-5 w-5 text-violet-500" />
            <span className="text-base font-black text-stone-900">⛪ 教会管理中枢</span>
          </div>
          <span className="text-xs text-stone-400">进入 →</span>
        </div>
        <div className="space-y-2">
          {['审核与批准团契申请', '团契及用户总览', '教会数据统计'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </a>
    )
  }

  if (role === 'pastor') {
    return (
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/60
                      px-6 py-5 shadow-md shadow-amber-900/5">
        <div className="flex items-center gap-2.5 mb-4">
          <BookOpen className="h-5 w-5 text-amber-500" />
          <span className="text-base font-black text-stone-900">👑 牧养关怀宏观控制台</span>
        </div>
        <div className="space-y-2">
          {['发布全教会今日经文', '旗下麦穗小组活跃度总览'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (role === 'group_leader') {
    return (
      <a href="/fellowship/console"
        className="block rounded-2xl border border-green-100 bg-gradient-to-br from-green-50/80 to-emerald-50/60
                   px-6 py-5 shadow-md shadow-green-900/5 transition-all hover:border-green-200 active:scale-[0.99]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-green-600" />
            <span className="text-base font-black text-stone-900">🌱 麦穗小组守望控制台</span>
          </div>
          <span className="text-xs text-stone-400">进入 →</span>
        </div>
        <div className="space-y-2">
          {['查看并刷新小组邀请码', '组员名册与关怀看板'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </a>
    )
  }

  // 普通用户
  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-6 py-5
                    shadow-md shadow-amber-900/5 backdrop-blur-md">
      <div className="flex items-center gap-2.5 mb-4">
        <Key className="h-5 w-5 text-stone-400" />
        <span className="text-base font-black text-stone-900">🌾 个人属灵私密卡片</span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-400 w-24 shrink-0">当前所属小组</span>
          <span className="font-medium text-stone-700">{fellowship ?? '暂未加入'}</span>
        </div>
        <a href="/fellowship/join"
          className="flex items-center justify-center gap-2 w-full rounded-xl
                     border border-amber-200 bg-amber-50/80 px-4 py-2.5
                     text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors">
          更换 / 申请加入团契
        </a>
      </div>
    </div>
  )
}
