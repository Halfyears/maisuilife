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
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
    // client_ts: ISO string from the browser's clock (localized to user's timezone)
    const clientTs    = typeof body.client_ts === 'string' ? body.client_ts : null

    // 至少需要心境或文字其中之一
    if (!transcript && !statusTag) {
      return NextResponse.json({ error: 'missing_content' }, { status: 400 })
    }
    if (transcript.length > 800) {
      return NextResponse.json({ error: 'transcript_too_long' }, { status: 400 })
    }

    rawTranscript = transcript

    // ── 3. AI: comfort + verse + summary via Gemini 1.5 Flash ───────────
    const aiResponse = await generateAlignmentResponse({
      transcript: rawTranscript,
      statusTag,
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
    // Prefer the client-provided ISO timestamp (user's actual local clock).
    // Fall back to UTC+8 server-side calculation if client_ts is absent or invalid.
    let clientDate: string
    if (clientTs) {
      const parsed = new Date(clientTs)
      clientDate = isNaN(parsed.getTime())
        ? new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
        : clientTs.slice(0, 10)
    } else {
      clientDate = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
    }

    // ── 6. Persist to daily_alignments (upsert by user+date) ────────────
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
    // Stores the AI comfort text + bible verse for the growth timeline.
    // Uses the RLS client so user_id = auth.uid() check passes.
    const { error: logErr } = await supabase
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
      console.error('[align] spiritual_log insert error:', logErr.code, logErr.message)
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
      alignmentId: alignment?.id ?? '',
      comfort:     aiResponse.comfort,
      verse:       aiResponse.verse,
      verse_ref:   aiResponse.verse_ref,
    })

  } catch (err) {
    const label = err instanceof Error ? err.name : 'UnknownError'
    console.error(`[align] pipeline error: ${label}`)
    return NextResponse.json({ error: 'pipeline_error' }, { status: 500 })

  } finally {
    rawTranscript = null
  }
}
