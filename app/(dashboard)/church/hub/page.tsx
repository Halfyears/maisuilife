import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Church, Home, Users, CheckCircle, Clock, XCircle, Wheat } from 'lucide-react'
import { ApproveButton } from '@/components/church/hub/approve-button'
import { RejectButton }  from '@/components/church/hub/reject-button'

export const metadata  = { title: '教会管理中枢 — 麦穗喜乐' }
export const revalidate = 0

const ROLE_ALLOWED = ['super_admin', 'church_admin']

export default async function ChurchHubPage() {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: profileRaw } = await db
    .from('users').select('role, display_name').eq('id', user.id).single()
  const profile = profileRaw as { role: string; display_name: string } | null
  const role = profile?.role ?? ''
  if (!ROLE_ALLOWED.includes(role)) redirect('/')

  const [fellowshipsRes, membersRes, usersRes] = await Promise.all([
    db.from('fellowships')
      .select('id, name, status, invite_code, meeting_mode, created_at, leader_id')
      .order('created_at', { ascending: false }),
    db.from('fellowship_members').select('fellowship_id, user_id'),
    db.from('users')
      .select('id, display_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const fellowships = (fellowshipsRes.data ?? []) as {
    id: string; name: string; status: string; invite_code: string;
    meeting_mode: string; created_at: string; leader_id: string
  }[]
  const members  = membersRes.data ?? []
  const allUsers = (usersRes.data ?? []) as {
    id: string; display_name: string; role: string; created_at: string
  }[]

  const memberCount: Record<string, number> = {}
  for (const m of members) memberCount[m.fellowship_id] = (memberCount[m.fellowship_id] ?? 0) + 1
  const userById = Object.fromEntries(allUsers.map(u => [u.id, u.display_name]))

  const pending  = fellowships.filter(f => f.status === 'pending')
  const approved = fellowships.filter(f => f.status === 'approved')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FBFBF9' }}>

      <header className="sticky top-0 z-30 border-b border-stone-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3.5">
          <Church className="h-5 w-5 text-violet-500 shrink-0" />
          <h1 className="text-base font-bold text-stone-900 shrink-0">教会管理中枢</h1>
          <span className="text-xs text-stone-400 hidden sm:inline">
            | {role === 'super_admin' ? '超级管理员' : '教会管理员'}
          </span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {role === 'super_admin' && (
              <Link href="/admin/hub"
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                           px-3 py-1.5 text-xs font-medium text-stone-500
                           hover:border-red-300 hover:text-red-700 hover:bg-red-50 transition-colors">
                ⚙️ 系统后台
              </Link>
            )}
            <Link href="/"
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white
                         px-3 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
              <Home className="h-3.5 w-3.5" />
              首页
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">

        {/* 概览统计 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '注册用户', value: allUsers.length,    icon: '👥', bg: 'bg-blue-50',   text: 'text-blue-700'   },
            { label: '团契总数', value: fellowships.length, icon: '🌾', bg: 'bg-amber-50',  text: 'text-amber-700'  },
            { label: '待审批',   value: pending.length,     icon: '⏳', bg: 'bg-orange-50', text: 'text-orange-700' },
            { label: '运行中',   value: approved.length,    icon: '✅', bg: 'bg-green-50',  text: 'text-green-700'  },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl ${s.bg} ${s.text} px-4 py-4 shadow-sm`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-70">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 待审批 */}
        {pending.length > 0 && (
          <section className="rounded-2xl border border-orange-100 bg-white/90 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-orange-100 bg-orange-50/50">
              <Clock className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-bold text-stone-900">待审批团契申请</h2>
              <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                {pending.length} 条
              </span>
            </div>
            <div className="divide-y divide-stone-50">
              {pending.map(f => (
                <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-900 text-sm">{f.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      组长：{userById[f.leader_id] ?? '未知'} · 聚会方式：{f.meeting_mode} · 申请时间：{f.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ApproveButton fellowshipId={f.id} leaderId={f.leader_id} />
                    <RejectButton  fellowshipId={f.id} leaderId={f.leader_id} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 团契总览 */}
        <section className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100">
            <Wheat className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-stone-900">团契总览</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  {['名称', '组长', '成员数', '邀请码', '状态', '创建日期'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {fellowships.map(f => (
                  <tr key={f.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-stone-900">{f.name}</td>
                    <td className="px-4 py-3 text-stone-600">{userById[f.leader_id] ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{memberCount[f.id] ?? 0} 人</td>
                    <td className="px-4 py-3 font-mono text-stone-500 tracking-wider text-xs">{f.invite_code}</td>
                    <td className="px-4 py-3">
                      {f.status === 'approved' && <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><CheckCircle className="h-3 w-3" />运行中</span>}
                      {f.status === 'pending'  && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"><Clock className="h-3 w-3" />待审批</span>}
                      {f.status === 'rejected' && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"><XCircle className="h-3 w-3" />已拒绝</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-400">{f.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
                {fellowships.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-400">暂无团契数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 用户总览 */}
        <section className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100">
            <Users className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold text-stone-900">用户总览</h2>
            <span className="ml-auto text-xs text-stone-400">最近 200 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  {['姓名', '角色', '注册日期'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {allUsers.map(u => (
                  <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-stone-900">{u.display_name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-stone-500">{
                      u.role === 'super_admin'  ? '⚡ 超级管理员' :
                      u.role === 'church_admin' ? '⛪ 教会管理员' :
                      u.role === 'group_leader' ? '🌱 组长' : '🌾 成员'
                    }</td>
                    <td className="px-4 py-2.5 text-xs text-stone-400">{u.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  )
}
