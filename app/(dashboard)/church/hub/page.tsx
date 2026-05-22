import { redirect }           from 'next/navigation'
import Link                    from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Church, Home, Users, Settings, Clock, Wheat, PlusCircle, BookOpen } from 'lucide-react'
import { ApproveButton }          from '@/components/church/hub/approve-button'
import { RejectButton }           from '@/components/church/hub/reject-button'
import { ChurchNameEditor }       from '@/components/church/hub/church-name-editor'
import { ScriptureEditor }        from '@/components/church/hub/scripture-editor'
import { FellowshipManageRow }    from '@/components/church/hub/fellowship-manage-row'
import { UserRoleRow }            from '@/components/church/hub/user-role-row'
import { CreateFellowshipForm }   from '@/components/church/hub/create-fellowship-form'

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
  const profile   = profileRaw as { role: string; display_name: string } | null
  const actorRole = profile?.role ?? ''
  if (!ROLE_ALLOWED.includes(actorRole)) redirect('/')

  const [fellowshipsRes, membersRes, usersRes, churchNameRes, scriptureRes] = await Promise.all([
    db.from('fellowships')
      .select('id, name, status, invite_code, meeting_mode, created_at, leader_id')
      .order('created_at', { ascending: false }),
    db.from('fellowship_members').select('fellowship_id, user_id'),
    db.from('users')
      .select('id, display_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    db.from('system_configs').select('value').eq('key', 'church_name').maybeSingle(),
    db.from('system_configs').select('value').eq('key', 'daily_scripture').maybeSingle(),
  ])

  const fellowships = (fellowshipsRes.data ?? []) as {
    id: string; name: string; status: string; invite_code: string;
    meeting_mode: string; created_at: string; leader_id: string | null
  }[]
  const members  = (membersRes.data ?? []) as { fellowship_id: string; user_id: string }[]
  const allUsers = (usersRes.data ?? []) as {
    id: string; display_name: string; role: string; created_at: string
  }[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const churchName: string = ((churchNameRes.data as any)?.value?.name) ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scriptureVal = (scriptureRes.data as any)?.value as { verse?: string; ref?: string } | null
  const scriptureVerse: string = scriptureVal?.verse?.trim() ?? ''
  const scriptureRef:   string = scriptureVal?.ref?.trim()   ?? ''

  const memberCount: Record<string, number> = {}
  for (const m of members) memberCount[m.fellowship_id] = (memberCount[m.fellowship_id] ?? 0) + 1

  const userFellowship: Record<string, string> = {}
  for (const m of members) {
    const f = fellowships.find(f => f.id === m.fellowship_id)
    if (f) userFellowship[m.user_id] = f.name
  }

  const pending  = fellowships.filter(f => f.status === 'pending')
  const approved = fellowships.filter(f => f.status === 'approved')
  const userById = Object.fromEntries(allUsers.map(u => [u.id, u.display_name]))

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FBFBF9' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-stone-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Church className="h-4 w-4 text-violet-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-400 leading-none">教会管理中枢</p>
            {churchName && <p className="text-sm font-semibold text-stone-800 truncate mt-0.5">{churchName}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actorRole === 'super_admin' && (
              <Link href="/admin/hub"
                className="rounded-xl border border-stone-200 bg-white px-2.5 py-1.5
                           text-xs font-medium text-stone-500
                           hover:border-red-300 hover:text-red-700 hover:bg-red-50 transition-colors">
                ⚙️ 系统
              </Link>
            )}
            <Link href="/settings"
              className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                         px-2.5 py-1.5 text-xs font-medium text-stone-500
                         hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">设置</span>
            </Link>
            <Link href="/"
              className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white
                         px-2.5 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">首页</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5 pb-10">

        {/* ── 教会名称 ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-stone-100 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500 mb-3">教会名称</p>
          <ChurchNameEditor initialName={churchName} />
        </section>

        {/* ── 今日经文 ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-stone-100 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-3.5 w-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-stone-500">今日经文</p>
            <p className="text-xs text-stone-400 ml-auto">显示在所有用户首页</p>
          </div>
          <ScriptureEditor initialVerse={scriptureVerse} initialRef={scriptureRef} />
        </section>

        {/* ── 概览统计（带锚点链接）─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '注册用户', value: allUsers.length,    icon: '👥', bg: 'bg-blue-50',   text: 'text-blue-700',   anchor: '#members'      },
            { label: '团契总数', value: fellowships.length, icon: '🌾', bg: 'bg-amber-50',  text: 'text-amber-700',  anchor: '#fellowships'  },
            { label: '待审批',   value: pending.length,     icon: '⏳', bg: 'bg-orange-50', text: 'text-orange-700', anchor: '#pending'      },
            { label: '运行中',   value: approved.length,    icon: '✅', bg: 'bg-green-50',  text: 'text-green-700',  anchor: '#fellowships'  },
          ].map(s => (
            <a key={s.label} href={s.anchor}
              className={`rounded-2xl ${s.bg} ${s.text} px-4 py-4 shadow-sm
                          active:scale-[0.97] transition-transform cursor-pointer block`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-70">{s.label}</div>
            </a>
          ))}
        </div>

        {/* ── 待审批 ──────────────────────────────────────────────────── */}
        {pending.length > 0 && (
          <section id="pending" className="rounded-2xl border border-orange-100 bg-white overflow-hidden shadow-sm scroll-mt-16">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-orange-100 bg-orange-50/50">
              <Clock className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-bold text-stone-900">待审批申请</h2>
              <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                {pending.length}
              </span>
            </div>
            <div className="divide-y divide-stone-50">
              {pending.map(f => (
                <div key={f.id} className="px-4 py-4 space-y-3">
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{f.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      组长：{f.leader_id ? (userById[f.leader_id] ?? '未知') : '暂无组长'} · {f.meeting_mode} · {f.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <ApproveButton fellowshipId={f.id} leaderId={f.leader_id} />
                    <RejectButton  fellowshipId={f.id} leaderId={f.leader_id} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 团契状态管理 ─────────────────────────────────────────────── */}
        <section id="fellowships" className="rounded-2xl border border-stone-100 bg-white overflow-hidden shadow-sm scroll-mt-16">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-stone-100">
            <Wheat className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-stone-900">团契管理</h2>
            <span className="ml-auto text-xs text-stone-400">点击编辑可修改名称、组长、状态</span>
          </div>

          {/* 手机：卡片列表 */}
          <div className="divide-y divide-stone-50 md:hidden">
            {fellowships.map(f => (
              <FellowshipManageRow
                key={f.id} fellowship={f}
                memberCount={memberCount[f.id] ?? 0}
                allUsers={allUsers}
              />
            ))}
            {fellowships.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-stone-400">暂无团契</p>
            )}
          </div>

          {/* 桌面：表格 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  {['名称', '组长', '成员', '邀请码', '状态', '创建', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fellowships.map(f => (
                  <FellowshipManageRow
                    key={f.id} fellowship={f}
                    memberCount={memberCount[f.id] ?? 0}
                    allUsers={allUsers}
                  />
                ))}
                {fellowships.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-stone-400">暂无团契</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-stone-50 space-y-3">
            <CreateFellowshipForm />
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 mb-2">新建团契步骤：</p>
              {[
                '确认未来组长已在本系统注册',
                '在下方「成员管理」中将其角色改为「组长」',
                '填写团契名称，搜索并选择组长（可暂不指定），点击创建',
                '点击「复制加入链接」，转发给团契成员，成员点击链接即可直接加入',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-stone-600">
                  <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-amber-800 font-bold text-[10px] mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 成员管理 ─────────────────────────────────────────────────── */}
        <section id="members" className="rounded-2xl border border-stone-100 bg-white overflow-hidden shadow-sm scroll-mt-16">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-stone-100">
            <Users className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold text-stone-900">成员管理</h2>
            <span className="ml-auto text-xs text-stone-400">{allUsers.length} 人 · 下拉修改权限</span>
          </div>

          {/* 手机：卡片 */}
          <div className="divide-y divide-stone-50 md:hidden">
            {allUsers.map(u => (
              <UserRoleRow key={u.id} user={u} actorRole={actorRole} fellowship={userFellowship[u.id]} />
            ))}
          </div>

          {/* 桌面：表格 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  {['姓名', '注册日期', '所属团契', '角色权限'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <UserRoleRow key={u.id} user={u} actorRole={actorRole} fellowship={userFellowship[u.id]} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 加入说明 ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-stone-100 bg-white/80 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-stone-400" />
            <p className="text-xs font-semibold text-stone-500">新成员如何加入教会与团契</p>
          </div>
          <div className="space-y-2">
            {[
              { icon: '⛪', title: '第一步：加入教会', desc: '新注册用户进入「设置中心 → 搜索 / 加入教会」，可用教会邀请码加入，或搜索教会名称后点击加入。' },
              { icon: '🌾', title: '第二步：加入团契', desc: '加入教会后，管理员可将成员分配至团契；或成员持团契加入链接（邀请码）自行加入。每位用户仅限加入 1 个团契。' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-2.5">
                <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-stone-700">{item.title}</p>
                  <p className="text-xs text-stone-500 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed border-t border-stone-100 pt-2">
            教会邀请码与团契邀请码各自独立。若需更换团契，须先联系管理员移除当前团契身份。
          </p>
        </div>

      </main>
    </div>
  )
}
