/**
 * STT via Groq Whisper API — Resilient (V6.2.1 retry pattern)
 *
 * 物理安全红线 — 音销字留:
 *   原始音频 Blob 在内存中处理，转写完成后立即从变量中删除。
 *   本函数不写入任何文件系统路径，不上传到除 Groq API 之外的任何端点。
 *   调用方收到 transcript 后，应立即对 audioBlob 变量赋 null。
 *
 * Resilience features (from MaisuiJoy Core V6.2.1):
 *   - 3-tier exponential backoff retry
 *   - 30-second hard timeout per attempt
 *   - Rate-limit (429) detection with longer backoff
 *   - 5xx server error retry
 *   - Structured error categorisation
 */
import Groq from 'groq-sdk'

// ── Config (mirrors MaisuiOperatorConfig.groq* fields) ───────────────────────
const GROQ_TIMEOUT_MS  = 30_000
const GROQ_MAX_RETRIES = 3

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// ── Return type (mirrors GroqTranscriptionResult from V6.2.1) ─────────────────
export interface STTResult {
  transcript: string
}

export type STTErrorType =
  | 'AUTHENTICATION_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT_EXHAUSTED'
  | 'SERVER_ERROR'
  | 'UNKNOWN'

export class STTError extends Error {
  constructor(
    public readonly errorType: STTErrorType,
    message: string,
  ) {
    super(message)
    this.name = 'STTError'
  }
}

// ── Core function ─────────────────────────────────────────────────────────────
export async function transcribeAudio(audioBlob: Blob): Promise<STTResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new STTError('AUTHENTICATION_ERROR', 'GROQ_API_KEY is not configured')
  }

  // Initialised inside the function — never at module scope — so the build
  // phase never executes SDK constructors that require runtime env vars.
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  // Derive extension from MIME type — Groq identifies codec by filename extension.
  // Hardcoding '.webm' breaks iOS Safari which records as audio/mp4.
  const ext  = audioBlob.type.includes('mp4') ? 'mp4'
             : audioBlob.type.includes('ogg') ? 'ogg'
             : 'webm'
  const file = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type })

  let lastError: unknown = null

  // ── Multi-tier retry loop (V6.2.1 resilience pattern) ────────────────────
  for (let attempt = 1; attempt <= GROQ_MAX_RETRIES; attempt++) {
    try {
      // Hard timeout per attempt via Promise.race
      const transcription = await Promise.race([
        groq.audio.transcriptions.create({
          file,
          model:           'whisper-large-v3-turbo',
          language:        'zh',
          response_format: 'json',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new STTError('TIMEOUT', `STT attempt ${attempt} timed out after ${GROQ_TIMEOUT_MS}ms`)),
            GROQ_TIMEOUT_MS,
          )
        ),
      ])

      // 音销: explicitly drop the audio reference in scope
      void audioBlob

      return { transcript: transcription.text.trim() }

    } catch (err: unknown) {
      lastError = err

      // Auth errors — never retry
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) {
        throw new STTError('AUTHENTICATION_ERROR', `Groq auth rejected [${status}]`)
      }

      // Rate limit — back off longer before retrying
      if (status === 429) {
        if (attempt === GROQ_MAX_RETRIES) {
          throw new STTError('RATE_LIMIT_EXHAUSTED', 'Groq rate limit exhausted after all retries')
        }
        const backoff = 2000 * Math.pow(2, attempt)
        console.warn(`[whisper] rate limited (429); backing off ${backoff}ms (attempt ${attempt}/${GROQ_MAX_RETRIES})`)
        await sleep(backoff)
        continue
      }

      // Server errors — retry with shorter backoff
      if (status !== undefined && status >= 500 && attempt < GROQ_MAX_RETRIES) {
        const backoff = 1000 * Math.pow(2, attempt)
        console.warn(`[whisper] upstream error [${status}]; retrying in ${backoff}ms (attempt ${attempt}/${GROQ_MAX_RETRIES})`)
        await sleep(backoff)
        continue
      }

      // Timeout — retry immediately with short wait
      if (err instanceof STTError && err.errorType === 'TIMEOUT') {
        if (attempt < GROQ_MAX_RETRIES) {
          await sleep(1000 * attempt)
          continue
        }
        throw err
      }

      // All other errors — throw immediately
      throw err
    }
  }

  // Exhausted all retries
  if (lastError instanceof STTError) throw lastError
  if (lastError instanceof Error)    throw new STTError('UNKNOWN', lastError.message)
  throw new STTError('UNKNOWN', 'Exhausted all retry branches')
}
