/**
 * GET /api/cron/daily-refresh
 *
 * Vercel Cron — 每天 12:00 中国时间（UTC 04:00）自动触发。
 * vercel.json: { "crons": [{ "path": "/api/cron/daily-refresh", "schedule": "0 4 * * *" }] }
 *
 * 任务：
 *   1. 为所有已审批团契预生成当日 AI 洞察（缓存热身）
 *   2. 记录执行日志到 system_configs（可选，用于监控）
 *
 * 安全：Vercel 自动在 Header 注入 Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // ── Auth: 只允许 Vercel Cron 调用 ──────────────────────
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db  = createServiceClient()
  const now = new Date().toISOString()

  // ── 获取所有已审批团契 ─────────────────────────────────
  const { data: fellowships } = await db
    .from('fellowships')
    .select('id')
    .eq('status', 'approved')

  if (!fellowships?.length) {
    return NextResponse.json({ ok: true, refreshed: 0, note: 'no active fellowships' })
  }

  // ── 预热每个团契的 AI 洞察 ───────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let refreshed = 0
  const errors: string[] = []

  if (baseUrl) {
    await Promise.allSettled(
      fellowships.map(async (f) => {
        try {
          const res = await fetch(
            `${baseUrl}/api/fellowship/insight?fellowship_id=${f.id}&force=1`,
            { cache: 'no-store' },
          )
          if (res.ok) refreshed++
          else errors.push(f.id)
        } catch {
          errors.push(f.id)
        }
      }),
    )
  }

  // ── 记录执行时间 ────────────────────────────────────────
  await db.from('system_configs').upsert(
    { key: 'last_daily_refresh', value: { ran_at: now, refreshed, errors } },
    { onConflict: 'key' },
  ).catch(() => null)

  return NextResponse.json({ ok: true, refreshed, errors, ran_at: now })
}
