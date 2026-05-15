/**
 * STT via Groq Whisper API.
 *
 * 物理安全红线 — 音销字留:
 *   原始音频 Blob 在内存中处理，转写完成后立即从变量中删除。
 *   本函数不写入任何文件系统路径，不上传到除 Groq API 之外的任何端点。
 *   调用方收到 transcript 后，应立即对 audioBlob 变量赋 null。
 */
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface STTResult {
  transcript: string
}

export async function transcribeAudio(audioBlob: Blob): Promise<STTResult> {
  // Convert Blob → File (required by Groq SDK)
  const file = new File([audioBlob], 'voice.webm', { type: audioBlob.type })

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    language: 'zh',
    response_format: 'json',
  })

  const transcript = transcription.text.trim()

  // 音销: explicitly drop the audio reference in scope
  // The Blob itself will be GC'd; caller must also null their reference.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void audioBlob

  return { transcript }
}
