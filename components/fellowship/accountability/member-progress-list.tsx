import type { MemberProgress } from '@/types'

const RANK_ICON = ['🥇', '🥈', '🥉']

const STATUS_BADGE: Record<MemberProgress['status'], { label: string; className: string }> = {
  perfect:  { label: '完美',   className: 'bg-green-50 text-green-700' },
  on_track: { label: '进行中', className: 'bg-amber-50 text-amber-700' },
  missing:  { label: '需加油', className: 'bg-stone-100 text-stone-500' },
}

const TODAY_BADGE: Record<'done' | 'missed' | 'postponed', { label: string; className: string }> = {
  done:      { label: '✓ 今日已打卡', className: 'text-green-600' },
  missed:    { label: '✗ 今日未完成', className: 'text-red-500'   },
  postponed: { label: '⏳ 今日延期',  className: 'text-amber-600' },
}

export function MemberProgressList({ members, myUserId }: {
  members: MemberProgress[]
  myUserId: string
}) {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white/90 px-5 py-8 text-center shadow-sm">
        <p className="text-sm text-stone-400">暂无成员数据</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 overflow-hidden shadow-sm shadow-amber-900/5">
      <div className="divide-y divide-stone-50">
        {members.map((m, idx) => {
          const sb    = STATUS_BADGE[m.status]
          const isSelf = m.user_id === myUserId
          const todayB = m.today_status ? TODAY_BADGE[m.today_status] : null

          return (
            <div
              key={m.user_id}
              className={[
                'px-5 py-4',
                isSelf ? 'bg-amber-50/40' : '',
              ].join(' ')}
            >
              {/* Top row: rank + name + status badge */}
              <div className="flex items-center gap-3 mb-2.5">
                <span className="text-xl w-7 text-center shrink-0">
                  {idx < 3 ? RANK_ICON[idx] : <span className="text-sm font-bold text-stone-400">{idx + 1}</span>}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isSelf ? 'text-amber-700' : 'text-stone-900'}`}>
                      {m.user_name}
                      {isSelf && <span className="ml-1 text-xs font-normal text-amber-500">（我）</span>}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sb.className}`}>
                      {sb.label}
                    </span>
                  </div>
                  {todayB && (
                    <p className={`text-[11px] font-medium mt-0.5 ${todayB.className}`}>{todayB.label}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-black text-stone-900">{m.completion_rate}<span className="text-xs font-medium text-stone-400">%</span></p>
                  <p className="text-[10px] text-stone-400">{m.completed}/{m.total} 次</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden ml-10">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-500',
                    m.status === 'perfect'  ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    m.status === 'on_track' ? 'bg-gradient-to-r from-amber-400 to-orange-400'  :
                                              'bg-stone-300',
                  ].join(' ')}
                  style={{ width: `${Math.max(m.completion_rate, 2)}%` }}
                />
              </div>

              {/* Consecutive days */}
              {m.consecutive_days > 0 && (
                <p className="text-[11px] text-stone-400 mt-1.5 ml-10">
                  🔥 连续 {m.consecutive_days} 天
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
