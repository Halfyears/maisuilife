import { redirect } from 'next/navigation'
import { Settings, Wheat, ShieldCheck, Users, BookOpen, Key, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/shared/bottom-nav'
import { SignOutButton } from '@/components/shared/sign-out-button'

export const metadata = { title: '设置中心 — 麦穗喜乐' }
export const revalidate = 0

// ── 角色徽标配置 ──────────────────────────────────────────────
const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  super_admin: {
    label: '⚡ 超级管理员',
    className: 'bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-xs px-3 py-1 rounded-full',
  },
  pastor: {
    label: '👑 属灵牧者',
    className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs px-3 py-1 rounded-full',
  },
  church: {
    label: '⛪ 教会管理',
    className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs px-3 py-1 rounded-full',
  },
  leader: {
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 读取自身数据：RLS 策略允许 auth.uid() = id，无需 service role
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

      {/* ── Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-stone-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2.5 px-5 py-3.5">
          <Settings className="h-4 w-4 text-stone-500" />
          <h1 className="text-sm font-bold text-stone-900">设置中心</h1>
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
            <p className="text-xs font-medium text-stone-500">MaisuiLife · 属灵陪伴，同行成长</p>
          </div>
        </div>

        {/* ── 高奢个人名片卡 ──────────────────────────────── */}
        <div className="rounded-2xl border border-stone-100 bg-white/90 shadow-md shadow-amber-900/5 backdrop-blur-md overflow-hidden">
          {/* 头像 + 名字 + 徽标 */}
          <div className="flex items-center gap-4 px-5 py-5 border-b border-stone-100">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full
                            bg-gradient-to-br from-amber-100 to-orange-100 text-2xl font-bold text-stone-700">
              {profile?.display_name?.slice(0, 1) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-stone-900 truncate">
                {profile?.display_name ?? '—'}
              </p>
              <p className="text-xs font-medium text-stone-400 truncate mt-0.5">{user.email}</p>
            </div>
            <span className={badge.className}>{badge.label}</span>
          </div>

          {/* 信息行 */}
          {[
            { Icon: LogIn,      label: 'MaisuiLife 守护年份', value: joinedYear ? `自 ${joinedYear} 年起` : '—' },
            { Icon: Wheat,      label: '所属麦穗团契',        value: fellowship ?? '暂未加入' },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50 last:border-0">
              <Icon className="h-4 w-4 text-stone-300 shrink-0" />
              <span className="text-xs font-medium text-stone-400 w-28 shrink-0">{label}</span>
              <span className="text-sm font-medium text-stone-700">{value}</span>
            </div>
          ))}
        </div>

        {/* ── 千人千面：专属管理中枢 ─────────────────────── */}
        <RolePanel role={role} fellowship={fellowship} />

        {/* ── 安全退出 ────────────────────────────────────── */}
        <SignOutButton />

        <p className="text-center text-[11px] text-stone-300 pb-2">
          麦穗喜乐 · MaisuiLife · 属灵陪伴，同行成长
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
      <a href="/admin/hub"
        className="block rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/80 to-orange-50/60
                   px-6 py-5 shadow-md shadow-red-900/5 transition-all hover:border-red-200 active:scale-[0.99]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-red-500" />
            <span className="text-base font-black text-stone-900">⚡ 全局超级管理中枢</span>
          </div>
          <span className="text-xs text-stone-400">进入 →</span>
        </div>
        <div className="space-y-2">
          {['全站 AI 断路器控制', '全局 API 接口开关', '系统运行日志大盘'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
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
          {['发布全教会今日经文', '旗下麦穗小组活跃度大盘'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (role === 'church') {
    return (
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/60
                      px-6 py-5 shadow-md shadow-amber-900/5">
        <div className="flex items-center gap-2.5 mb-4">
          <Settings className="h-5 w-5 text-amber-500" />
          <span className="text-base font-black text-stone-900">⛪ 教会管理控制台</span>
        </div>
        <div className="space-y-2">
          {['发布全教会今日经文', '旗下麦穗小组活跃度大盘'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (role === 'leader') {
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
          {['查看 / 刷新 6 位小组邀请码', '组员名册审核管理'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </a>
    )
  }

  // 普通 user / member
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
