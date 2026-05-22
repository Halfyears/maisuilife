import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ConfirmLeaderButton } from './confirm-button'

export const metadata = { title: '确认担任组长 — 麦穗喜乐' }

interface FellowshipRow {
  id: string
  name: string
  leader_pending_id: string | null
}

export default async function ConfirmLeaderPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token ?? ''

  if (!token) return <TokenInvalidState />

  const db = createServiceClient()
  const { data: raw } = await db
    .from('fellowships')
    .select('id, name, leader_pending_id')
    .eq('leader_appointment_token', token)
    .maybeSingle()

  if (!raw) return <TokenInvalidState />

  const fellowship = raw as unknown as FellowshipRow

  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user ?? null

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/fellowship/confirm-leader?token=${token}`)}`)
  }

  if (user.id !== fellowship.leader_pending_id) {
    return <WrongUserState fellowshipName={fellowship.name} />
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-amber-50/30 px-5">
      <div className="w-full max-w-sm rounded-3xl border border-amber-100 bg-white p-8 shadow-md shadow-amber-900/5">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full
                          bg-gradient-to-br from-amber-100 to-orange-100 text-3xl shadow-sm">
            🌾
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              麦穗喜乐
            </p>
            <h1 className="text-lg font-bold text-stone-900">受邀担任团契组长</h1>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 w-full">
            <p className="text-[11px] text-amber-600 mb-1">团契名称</p>
            <p className="text-base font-bold text-stone-900">{fellowship.name}</p>
          </div>
          <p className="text-sm text-stone-500 leading-relaxed">
            您被教会管理员邀请担任此团契的组长。确认后，您将正式承担带领责任，
            团队成员将以您为守望中心。
          </p>
          <ConfirmLeaderButton token={token} />
        </div>
      </div>
    </div>
  )
}

function TokenInvalidState() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-amber-50/30 px-5">
      <div className="w-full max-w-sm rounded-3xl border border-stone-100 bg-white p-8
                      shadow-md shadow-amber-900/5 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-2xl">
            🔗
          </div>
          <h1 className="text-base font-bold text-stone-900">链接无效或已失效</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            此邀请链接不存在或已被使用。请向教会管理员重新申请邀请。
          </p>
        </div>
      </div>
    </div>
  )
}

function WrongUserState({ fellowshipName }: { fellowshipName: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-amber-50/30 px-5">
      <div className="w-full max-w-sm rounded-3xl border border-amber-100 bg-white p-8
                      shadow-md shadow-amber-900/5 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl">
            👤
          </div>
          <h1 className="text-base font-bold text-stone-900">此邀请不属于您</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            「{fellowshipName}」的组长邀请是发给其他成员的。
            请以正确账号登录后再访问此链接。
          </p>
        </div>
      </div>
    </div>
  )
}
