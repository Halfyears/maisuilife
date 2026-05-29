/**
 * POST /api/align
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  文字路径 — 跳过 STT，直接运行 AI 对齐               ║
 * ║  原始文字摘要仅存活于本函数作用域。                   ║
 * ║  finally 块确保敏感变量必被清零。                     ║
 * ║  严禁写入日志、严禁落盘、严禁透传给客户端。           ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * 请求体 JSON：
 *   transcript   string   用户手动输入的文字（≤ 800 字）
 *   status_tag   string   感恩 | 平安 | 疲惫 | 干渴 | 混乱
 *   is_urgent    boolean  是否标记代祷需求
 *   fellowship_id string  (is_urgent=true 时必填)
 *
 * 成功响应 200：
 *   { alignmentId, comfort, verse, verse_ref }
 *   — summary 已加密落库，绝不返回给客户端
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, createAdminClient } from '@/lib/supabase/server'
import { generateAlignmentResponse } from '@/lib/ai/gemini'
import { encrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // ── 0. Auth gate ────────────────────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 0b. Global AI Circuit Breaker check ─────────────────
  {
    const { data: cbRow } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'ai_circuit_breaker')
      .single()
    if (cbRow?.value?.active === false) {
      return NextResponse.json(
        { error: 'ai_circuit_breaker', message: 'AI 服务暂时停止，请稍后再试' },
        { status: 503 }
      )
    }
  }

  // ── 1. Declare sensitive var outside try so finally can clear it ─────
  let rawTranscript: string | null = null

  try {
    // ── 2. Parse JSON body ──────────────────────────────────
    const body = await req.json()
    const transcript  = (typeof body.transcript === 'string' ? body.transcript : '').trim()
    const statusTag   = typeof body.status_tag === 'string' ? body.status_tag : ''
    const isUrgent    = body.is_urgent === true
    const fellowshipId = typeof body.fellowship_id === 'string' ? body.fellowship_id.trim() || null : null
    // client_date: YYYY-MM-DD in browser's local timezone (replaces client_ts)
    const clientDate_raw = typeof body.client_date === 'string' ? body.client_date : null

    // 至少需要心境或文字其中之一
    if (!transcript && !statusTag) {
      return NextResponse.json({ error: 'missing_content' }, { status: 400 })
    }
    if (transcript.length > 800) {
      return NextResponse.json({ error: 'transcript_too_long' }, { status: 400 })
    }

    rawTranscript = transcript

    // ── 3a. 查询该用户最近 5 条已使用的经文引用（千人千面：避免重复）──────
    let recentRefs: string[] = []
    try {
      const { data: recentLogs, error: refError } = await supabase
        .from('spiritual_logs')
        .select('bible_ref')
        .eq('user_id', user.id)
        .not('bible_ref', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)
      // 同时检查 error 字段：Supabase 错误不一定抛异常
      if (!refError && recentLogs) {
        recentRefs = recentLogs
          .map((r: { bible_ref: string | null }) => r.bible_ref ?? '')
          .filter(Boolean)
      }
    } catch {
      // 非关键路径：查询失败不阻断主流程
    }

    // ── 3b. AI: comfort + verse + summary via Groq ──────────────────────
    const aiResponse = await generateAlignmentResponse({
      transcript: rawTranscript,
      statusTag,
      recentRefs,
    })

    // ■ 音销 — raw transcript no longer needed
    rawTranscript = null

    // ── 4. Encrypt summary (AES-256-GCM) before any persistence ─────────
    // Non-fatal: if ENCRYPTION_KEY is missing/invalid, skip encrypted storage
    // and still return the AI response to the client.
    let ai_summary_enc: string | null = null
    try {
      const encryptedBuf = encrypt(aiResponse.summary)
      ai_summary_enc = '\\x' + encryptedBuf.toString('hex')
    } catch {
      console.error('[align] encryption unavailable — AI response will still be returned')
    }

    // ── 5. Resolve client date ────────────────────────────────────────────
    // Trust the YYYY-MM-DD date the browser sends (already in local timezone).
    // Fall back to LA time on the server if client_date is absent or malformed.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    const clientDate: string = (clientDate_raw && DATE_RE.test(clientDate_raw))
      ? clientDate_raw
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

    // ── 6. Check if first submission today (for wheat count) ────────────
    const { data: existingAlignment } = await supabase
      .from('daily_alignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', clientDate)
      .maybeSingle()
    const isFirstSubmission = !existingAlignment

    // ── 6b. Persist to daily_alignments (upsert by user+date) ────────────
    const { data: alignment, error: dbError } = await supabase
      .from('daily_alignments')
      .upsert(
        {
          user_id:        user.id,
          status_tag:     statusTag,
          theme_tags:     [],
          ...(ai_summary_enc !== null ? { ai_summary_enc } : {}),
          is_urgent:      isUrgent,
          date:           clientDate,
          is_visible:     true,
        },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (dbError) {
      // DB 写入失败记录日志，但不阻断 AI 响应返回给用户
      console.error('[align] db upsert error:', dbError.code, dbError.message)
    }

    // ── 7. Persist to spiritual_logs (growth timeline) ───────────────────
    // 使用 service client 绕过 RLS，确保 bible_verse 写入成功
    // （RLS INSERT 策略缺失时 supabase 用户客户端会静默失败）
    const svcDb = createServiceClient()
    const { error: logErr } = await svcDb
      .from('spiritual_logs')
      .insert({
        user_id:     user.id,
        mood:        statusTag || null,
        ai_comfort:  aiResponse.comfort,
        bible_verse: aiResponse.verse,
        bible_ref:   aiResponse.verse_ref,
        client_date: clientDate,
      })
    if (logErr) {
      console.error('[align] spiritual_log INSERT FAILED', {
        code:     logErr.code,
        message:  logErr.message,
        details:  logErr.details,
        hint:     logErr.hint,
        userId:   user.id,
        clientDate,
      })
    }

    // ── 7b. Increment wheat counters on first daily submission ──────────
    let contributedWheat = false
    if (isFirstSubmission && !dbError) {
      try {
        const adminDb = createAdminClient()
        const { data: membership } = await adminDb
          .from('fellowship_members')
          .select('fellowship_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()
        if (membership?.fellowship_id) {
          await Promise.allSettled([
            adminDb.rpc('increment_wheat_count',  { p_fellowship_id: membership.fellowship_id }),
            adminDb.rpc('increment_vault_wheat',  { p_fellowship_id: membership.fellowship_id }),
          ])
          contributedWheat = true
        }
      } catch {
        // wheat increment is non-critical; don't fail the request
      }
    }

    // ── 8. If urgent, create anonymous urgent_flag via RPC ────────────────
    if (isUrgent && fellowshipId && alignment) {
      const db = createServiceClient()
      const { error: flagErr } = await db.rpc('flag_urgent', {
        p_alignment_id:  alignment.id,
        p_fellowship_id: fellowshipId,
      })
      if (flagErr) {
        console.error('[align] urgent flag error:', flagErr.code)
      }
    }

    // ── 9. Return only what the UI needs ─────────────────────────────────
    return NextResponse.json({
      alignmentId:       alignment?.id ?? '',
      comfort:           aiResponse.comfort,
      verse:             aiResponse.verse,
      verse_ref:         aiResponse.verse_ref,
      contributed_wheat: contributedWheat,
    })

  } catch (err) {
    const label = err instanceof Error ? err.name : 'UnknownError'
    console.error(`[align] pipeline error: ${label}`)
    return NextResponse.json({ error: 'pipeline_error' }, { status: 500 })

  } finally {
    rawTranscript = null
  }
}
