'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Check, X, Plus, Edit2, ChevronDown, ChevronUp,
  Users, MapPin, Phone, Crown, ChevronRight,
} from 'lucide-react'
import type { PendingFellowship, ActiveFellowship, SelectableMember, FellowshipMember } from '../page'

// ── shared post helper ────────────────────────────────────────
async function callApi(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'request_failed')
  }
  return res.json()
}

const ROLE_LABEL: Record<string, string> = {
  group_leader: '组长',
  church_admin: '管理员',
  member:       '信徒',
}

// ── Pending fellowship card ───────────────────────────────────
function PendingCard({
  f,
  onApprove,
  onReject,
  busy,
}: {
  f: PendingFellowship
  onApprove: (id: string, addr: string, contact: string) => void
  onReject:  (id: string) => void
  busy: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [addr,    setAddr]    = useState(f.meeting_address ?? '')
  const [contact, setContact] = useState(f.leader_contact  ?? '')

  const proposer = (f.users as { display_name: string } | null)?.display_name ?? '—'
  const date = new Date(f.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })

  return (
    <div className="rounded-2xl border border-amber-100 bg-white/90 overflow-hidden shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-stone-900 truncate">{f.name}</p>
          <p className="text-xs text-stone-400 mt-0.5">申请人：{proposer} · {date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            填写资料 {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            onClick={() => onReject(f.id)}
            disabled={busy}
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={() => onApprove(f.id, addr, contact)}
            disabled={busy}
            className="flex items-center gap-1.5 h-8 rounded-xl bg-green-500 px-3 text-xs font-bold text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            批准
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 border-t border-stone-50 pt-3 space-y-2.5">
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">聚会地址（可选）</label>
            <input
              value={addr}
              onChange={e => setAddr(e.target.value)}
              placeholder="例：恩典教会 B101 室"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">组长联系方式（可选）</label>
            <input
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="例：微信 / 手机号"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── 3-tier Active fellowship tree card ───────────────────────
function ActiveTreeCard({
  f,
  members,
  onUpdate,
  busy,
}: {
  f: ActiveFellowship
  members: SelectableMember[]
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  busy: boolean
}) {
  const [editing,   setEditing]   = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [name,      setName]      = useState(f.name)
  const [leaderId,  setLeaderId]  = useState((f.users as { id: string } | null)?.id ?? '')
  const [addr,      setAddr]      = useState(f.meeting_address ?? '')
  const [contact,   setContact]   = useState(f.leader_contact  ?? '')

  const leaderName  = (f.users as { display_name: string } | null)?.display_name ?? '—'
  const rawMembers  = (f.fellowship_members ?? []) as FellowshipMember[]
  const memberCount = rawMembers.length

  // Separate leader from regular members for display
  const leaderId_actual = (f.users as { id: string } | null)?.id
  const regularMembers  = rawMembers.filter(m => m.user_id !== leaderId_actual)

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm">

      {/* ── Fellowship row ──────────────────────────────────── */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Fellowship name + invite code */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-stone-900">{f.name}</p>
              <span className="font-mono text-[10px] text-stone-400 bg-stone-50 border border-stone-100 rounded-full px-2 py-0.5 tracking-widest">
                {f.invite_code}
              </span>
            </div>

            {/* Meta: leader + member count */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                <Crown className="h-3 w-3" />
                {leaderName}
              </span>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                <Users className="h-3 w-3" />
                {memberCount} 位成员
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Address + contact */}
            {f.meeting_address && (
              <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />{f.meeting_address}
              </p>
            )}
            {f.leader_contact && (
              <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />{f.leader_contact}
              </p>
            )}
          </div>

          <button
            onClick={() => setEditing(v => !v)}
            className="flex items-center gap-1 shrink-0 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-500 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors"
          >
            <Edit2 className="h-3 w-3" />编辑
          </button>
        </div>
      </div>

      {/* ── Member tree (collapsible) ───────────────────────── */}
      {expanded && (
        <div className="border-t border-stone-50 px-5 pb-4 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
            成员名册 ({memberCount})
          </p>
          <div className="border-l-2 border-violet-100 pl-4 space-y-2">

            {/* Leader row */}
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-700">{leaderName}</span>
              <span className="text-[10px] text-violet-500 font-medium bg-violet-50 border border-violet-100 rounded-full px-1.5 py-0.5">组长</span>
            </div>

            {/* Regular members */}
            {regularMembers.length > 0 ? (
              regularMembers.map(m => {
                const displayName = m.users?.display_name ?? m.user_id.slice(0, 8)
                const roleLabel   = ROLE_LABEL[m.users?.role ?? ''] ?? '信徒'
                return (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-stone-300 shrink-0" />
                    <span className="text-xs text-stone-600">{displayName}</span>
                    <span className="text-[10px] text-stone-400">{roleLabel}</span>
                  </div>
                )
              })
            ) : (
              <p className="text-[11px] text-stone-400 italic">暂无其他成员</p>
            )}
          </div>
        </div>
      )}

      {/* ── Edit form ────────────────────────────────────────── */}
      {editing && (
        <div className="px-5 pb-5 border-t border-stone-50 pt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">小组名称</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">指定组长</label>
            <select
              value={leaderId}
              onChange={e => setLeaderId(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="">— 选择成员 —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.display_name} ({ROLE_LABEL[m.role] ?? m.role})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-500 block mb-1">聚会地址</label>
              <input
                value={addr}
                onChange={e => setAddr(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500 block mb-1">联系方式</label>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-500 hover:bg-stone-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                onUpdate(f.id, {
                  name:            name.trim() || f.name,
                  leader_id:       leaderId || undefined,
                  meeting_address: addr.trim()    || null,
                  leader_contact:  contact.trim() || null,
                })
                setEditing(false)
              }}
              disabled={busy}
              className="flex-1 py-2 rounded-xl bg-violet-500 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : '保存更改'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create fellowship form ────────────────────────────────────
function CreateForm({
  members,
  onSuccess,
}: {
  members: SelectableMember[]
  onSuccess: () => void
}) {
  const [name,     setName]     = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [addr,     setAddr]     = useState('')
  const [contact,  setContact]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim() || !leaderId) return
    setBusy(true); setError(null)
    try {
      await callApi('/api/church/fellowship/create', {
        name:            name.trim(),
        leader_id:       leaderId,
        meeting_address: addr.trim()    || null,
        leader_contact:  contact.trim() || null,
      })
      setName(''); setLeaderId(''); setAddr(''); setContact('')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-5 shadow-sm space-y-3">
      <p className="text-sm font-bold text-stone-900">⛪ 直接创建新团契</p>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      <div>
        <label className="text-xs font-medium text-stone-500 block mb-1">小组名称 *</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={30}
          placeholder="例：恩典甘霖小组"
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-stone-500 block mb-1">指定组长 *</label>
        <select
          value={leaderId}
          onChange={e => setLeaderId(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          <option value="">— 从成员中选择 —</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-stone-500 block mb-1">聚会地址</label>
          <input
            value={addr}
            onChange={e => setAddr(e.target.value)}
            placeholder="可选"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-stone-500 block mb-1">联系方式</label>
          <input
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="可选"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={!name.trim() || !leaderId || busy}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600 text-sm font-black text-white tracking-widest shadow-md shadow-violet-500/20 disabled:opacity-40 transition-all active:scale-[0.99]"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />正在创建…
          </span>
        ) : (
          '＋ 立即创建并激活'
        )}
      </button>
    </div>
  )
}

// ── Main hub client ───────────────────────────────────────────
export function ChurchHubClient({
  pending,
  active,
  members,
  adminName,
}: {
  pending:   PendingFellowship[]
  active:    ActiveFellowship[]
  members:   SelectableMember[]
  adminName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleApprove(id: string, addr: string, contact: string) {
    setBusyId(id)
    try {
      await callApi('/api/church/fellowship/approve', { fellowship_id: id, meeting_address: addr || null, leader_contact: contact || null })
      refresh()
    } finally { setBusyId(null) }
  }

  async function handleReject(id: string) {
    setBusyId(id)
    try {
      await callApi('/api/church/fellowship/reject', { fellowship_id: id })
      refresh()
    } finally { setBusyId(null) }
  }

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    setBusyId(id)
    try {
      await callApi('/api/church/fellowship/update', { fellowship_id: id, ...patch })
      refresh()
    } finally { setBusyId(null) }
  }

  const busy = isPending || busyId !== null

  const totalMembers = active.reduce((sum, f) => sum + (f.fellowship_members?.length ?? 0), 0)

  return (
    <div className="space-y-8">

      {/* ── 3-tier hierarchy overview banner ──────────────── */}
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-purple-50/60 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400 mb-3">教会治理架构</p>
        <div className="flex items-start gap-3">
          {/* Tier 1: Church Admin */}
          <div className="flex flex-col items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg shadow-sm">⛪</div>
            <div className="w-px h-6 bg-violet-200 my-1" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-xs font-bold text-violet-700">{adminName}</p>
            <p className="text-[10px] text-violet-500">教会管理员</p>
          </div>
        </div>

        {/* Tier 2+3 summary */}
        <div className="mt-1 border-l-2 border-violet-200 pl-4 ml-5 space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span className="text-xs text-stone-600">
              <span className="font-bold text-violet-600">{active.length}</span> 个已批准团契
              · <span className="font-bold text-violet-600">{totalMembers}</span> 位信徒成员
            </span>
          </div>
          {pending.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-amber-600 font-medium">{pending.length} 个申请待审核</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Pending applications ──────────────────────────── */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-sm font-bold text-stone-900">待审核申请</h2>
          {pending.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-white/60 px-5 py-8 text-center">
            <p className="text-sm text-stone-400">暂无待审核的团契申请</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(f => (
              <PendingCard
                key={f.id}
                f={f}
                onApprove={handleApprove}
                onReject={handleReject}
                busy={busy && busyId === f.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Active fellowships (3-tier tree) ────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-stone-900">已批准团契 · 灵牧架构 ({active.length})</h2>
        </div>

        {active.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-white/60 px-5 py-8 text-center">
            <p className="text-sm text-stone-400">还没有批准任何团契</p>
          </div>
        ) : (
          <div className="border-l-2 border-violet-100 pl-4 space-y-3">
            {active.map(f => (
              <ActiveTreeCard
                key={f.id}
                f={f}
                members={members}
                onUpdate={handleUpdate}
                busy={busy && busyId === f.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Direct create ─────────────────────────────────── */}
      <section>
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 py-4 text-sm font-bold text-violet-700 hover:bg-violet-50 transition-colors active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            直接创建新团契
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400">填写后立即激活，无需审核</span>
              <button onClick={() => setShowCreate(false)} className="text-xs text-stone-400 hover:text-stone-600">收起</button>
            </div>
            <CreateForm
              members={members}
              onSuccess={() => { setShowCreate(false); refresh() }}
            />
          </div>
        )}
      </section>

    </div>
  )
}
