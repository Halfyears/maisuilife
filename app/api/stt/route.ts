/**
 * POST /api/stt
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  物理安全红线 — 音销字留                              ║
 * ║  原始音频字节和转写长文仅存活于本函数作用域。         ║
 * ║  finally 块确保：无论成功/异常，敏感变量必被清零。    ║
 * ║  严禁写入日志、严禁落盘、严禁透传给客户端。           ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * multipart/form-data 字段：
 *   audio        File     webm/opus 录音
 *   status_tag   string   感恩 | 平安 | 疲惫 | 干渴 | 混乱
 *   is_urgent    string   'true' | 'false' — 是否标记代祷需求
 *   fellowship_id string  (is_urgent=true 时必填)
 *
 * 成功响应 200：
 *   { alignmentId, comfort, verse, verse_ref }
 *   — summary 已加密落库，绝不返回给客户端
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { transcribeAudio } from '@/lib/ai/whisper'
import { generateAlignmentResponse } from '@/lib/ai/gemini'
import { encrypt } from '@/lib/crypto'
import type { StatusTagValue } from '@/lib/constants'

export const runtime = 'nodejs'  // crypto + Buffer require Node.js runtime

export async function POST(req: NextRequest) {
  // ── 0. Auth gate ────────────────────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 0b. Runtime key guard (build-safe) ──────────────────
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'STT configuration missing' }, { status: 500 })
  }

  // ── 0d. Global AI Circuit Breaker check ─────────────────
  // Reads system_configs via anon key (RLS allows authenticated read).
  // If active=false, reject immediately without touching audio/STT.
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

  // ── 1. Declare sensitive vars outside try so finally can clear them ─────
  //    These are the ONLY variables that will ever hold audio bytes or raw text.
  let audioBuffer: Buffer | null = null
  let rawTranscript: string | null = null

  try {
    // ── 2. Parse multipart form ──────────────────────────
    const form = await req.formData()
    const audioFile    = form.get('audio')
    const statusTag    = (form.get('status_tag') as string | null)?.trim() as StatusTagValue
    const isUrgent     = form.get('is_urgent') === 'true'
    const fellowshipId = (form.get('fellowship_id') as string | null)?.trim() || null

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ error: 'missing_audio' }, { status: 400 })
    }
    if (!statusTag) {
      return NextResponse.json({ error: 'missing_status_tag' }, { status: 400 })
    }

    // ── 3. Load audio into memory — NEVER touch the filesystem ──────────
    //    Buffer.from(ArrayBuffer) allocates a new Node.js Buffer on the heap.
    //    No temp file, no stream, no disk path.
    audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    // ── 4. STT via Groq Whisper ──────────────────────────────────────────
    //    whisper.ts creates a transient Blob from the buffer for the API call.
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type || 'audio/webm' })
    const { transcript } = await transcribeAudio(audioBlob)

    // ■ 音销 step A: audio bytes no longer needed after STT — zero & release
    audioBuffer.fill(0)
    audioBuffer = null

    rawTranscript = transcript

    // ── 5. AI: comfort + verse + summary via Gemini 1.5 Flash ───────────
    const aiResponse = await generateAlignmentResponse({
      transcript: rawTranscript,
      statusTag,
    })

    // ■ 音销 step B: raw long-form transcript no longer needed
    rawTranscript = null

    // ── 6. Encrypt summary (AES-256-GCM) before any persistence ─────────
    //    encrypt() returns a Buffer: [iv(12)][tag(16)][ciphertext]
    //    Supabase BYTEA accepts hex-prefixed strings via PostgREST
    const encryptedBuf   = encrypt(aiResponse.summary)
    const ai_summary_enc = '\\x' + encryptedBuf.toString('hex')

    // ── 7. Persist to daily_alignments (upsert by user+date) ────────────
    const { data: alignment, error: dbError } = await supabase
      .from('daily_alignments')
      .upsert(
        {
          user_id:        user.id,
          status_tag:     statusTag,
          theme_tags:     [],
          ai_summary_enc,
          is_urgent:      isUrgent,
          date:           new Date().toISOString().slice(0, 10),
          is_visible:     true,
        },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (dbError) {
      console.error('[stt] db upsert error:', dbError.code)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    // ── 8. If urgent, create anonymous urgent_flag via RPC ────────────────
    // The RPC (SECURITY DEFINER) validates membership and inserts the flag.
    // Errors here are non-fatal: the alignment is already saved.
    if (isUrgent && fellowshipId) {
      const db = createServiceClient()
      const { error: flagErr } = await db.rpc('flag_urgent', {
        p_alignment_id:  alignment.id,
        p_fellowship_id: fellowshipId,
      })
      if (flagErr) {
        console.error('[stt] urgent flag error:', flagErr.code)
        // Non-fatal: don't fail the whole submission
      }
    }

    // ── 9. Return only what the UI needs — summary stays encrypted in DB ─
    return NextResponse.json({
      alignmentId: alignment.id,
      comfort:     aiResponse.comfort,
      verse:       aiResponse.verse,
      verse_ref:   aiResponse.verse_ref,
    })

  } catch (err) {
    // Log error type + message — never log audioBuffer or rawTranscript
    const name = err instanceof Error ? err.name    : 'UnknownError'
    const msg  = err instanceof Error ? err.message : String(err)
    console.error(`[stt] pipeline error: ${name} — ${msg}`)
    return NextResponse.json({ error: 'pipeline_error' }, { status: 500 })

  } finally {
    // ══════════════════════════════════════════════════════
    // 物理红线 — 音销字留 (MANDATORY CLEANUP)
    // Runs unconditionally after success OR any thrown error.
    //
    // fill(0): overwrites Buffer's underlying ArrayBuffer with zeros
    // so the audio PCM/encoded bytes cannot be recovered from heap dumps
    // or GC scan windows before the reference is dropped.
    // ══════════════════════════════════════════════════════
    if (audioBuffer !== null) {
      audioBuffer.fill(0)
      audioBuffer = null
    }
    // rawTranscript is a JS string (immutable, GC-controlled).
    // Setting to null drops the only reference from this scope.
    rawTranscript = null
  }
}
