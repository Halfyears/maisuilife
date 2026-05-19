'use client'

import { useState } from 'react'
import { BookOpen, Loader2, Copy, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import type { MeetingOutline } from '@/app/api/fellowship/outline/route'

interface Props {
  fellowshipId: string
}

export function OutlineGenerator({ fellowshipId }: Props) {
  const [meetingType, setMeetingType] = useState<'theme' | 'scripture'>('theme')
  const [query, setQuery]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [outline, setOutline]         = useState<MeetingOutline | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const [expanded, setExpanded]       = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true, 3: true, 4: true })

  async function generate() {
    if (!query.trim() || loading) return
    setLoading(true)
    setError(null)
    setOutline(null)

    try {
      const res = await fetch('/api/fellowship/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fellowship_id: fellowshipId, meeting_type: meetingType, input_query: query.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error === 'ai_not_configured' ? 'AI 服务未配置' : 'AI 生成失败，请稍后重试')
        return
      }
      const data: MeetingOutline = await res.json()
      setOutline(data)
      setExpanded({ 0: true, 1: true, 2: true, 3: true, 4: true })
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  function buildFullText(): string {
    if (!outline) return ''
    const { ai_member_insight: insight, ai_sermon_lecture: sermon } = outline
    const typeLabel = outline.meeting_type === 'theme' ? '主题查经' : '经文查经'
    const sections = [
      `【${typeLabel}备课大纲】${outline.input_query}`,
      '',
      '── 会前洞察（10分钟）──',
      `▌ 本周团契状态\n${insight.problem_summary}`,
      `▌ 属灵定性\n${insight.bible_framework}`,
      '',
      '── 经文原段 ──',
      sermon.scripture_text_full,
      '',
      '── 讲道阐述（30-45分钟）──',
      ...sermon.theological_breakdown.map((s, i) => `${i === 0 ? '【引言】' : i === 4 ? '【结论呼召】' : ''}\n${s}`),
      '',
      '── 交通问题 ──',
      ...sermon.application_questions.map((q, i) => `Q${i + 1}. ${q}`),
      '',
      `（由麦穗喜乐 AI 备课助手生成 · ${new Date(outline.generated_at).toLocaleString('zh-CN')}）`,
    ]
    return sections.join('\n\n')
  }

  async function copyAll() {
    await navigator.clipboard.writeText(buildFullText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sectionTitles = ['引言', '论点一', '论点二', '论点三', '结论呼召']

  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 shadow-md shadow-amber-900/5">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-stone-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
          <BookOpen className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-stone-900">AI 备课助手</h3>
          <p className="text-[11px] text-stone-400">三维结构 · 总分总骨架 · 30-45 分钟精准时控</p>
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-3">
        {/* Type toggle */}
        <div className="flex rounded-xl overflow-hidden border border-stone-200 text-xs font-medium">
          {(['theme', 'scripture'] as const).map(t => (
            <button
              key={t}
              onClick={() => setMeetingType(t)}
              className={`flex-1 py-2 transition-colors ${
                meetingType === t
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              {t === 'theme' ? '📖 主题查经' : '📜 经文查经'}
            </button>
          ))}
        </div>

        {/* Query input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder={meetingType === 'theme' ? '输入主题，如：职场诚实、饶恕与和好' : '输入经文，如：罗马书8章、诗篇23篇'}
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm
                       text-stone-900 placeholder:text-stone-300
                       focus:border-amber-400 focus:bg-white focus:outline-none transition-colors"
          />
          <button
            onClick={generate}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5
                       text-sm font-bold text-white hover:bg-amber-600
                       disabled:opacity-50 transition-colors shrink-0"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />生成中…</>
              : <><Sparkles className="h-4 w-4" />生成大纲</>}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 px-1">{error}</p>
        )}
      </div>

      {/* ── Loading skeleton ────────────────────────────────── */}
      {loading && (
        <div className="px-5 pb-5 space-y-3">
          {[80, 60, 100, 90, 75].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
              <div className={`h-2.5 animate-pulse rounded bg-stone-100`} style={{ width: `${w}%` }} />
              <div className="h-2.5 w-11/12 animate-pulse rounded bg-stone-100" />
            </div>
          ))}
          <p className="text-center text-xs text-stone-400 animate-pulse pt-2">
            AI 正在研读经文、编织讲章，约需 20-40 秒…
          </p>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {outline && !loading && (
        <div className="px-5 pb-5 space-y-4">

          {/* Copy button */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400">
              {outline.meeting_type === 'theme' ? '📖 主题' : '📜 经文'}：{outline.input_query}
            </span>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white
                         px-3 py-1.5 text-xs font-medium text-stone-500
                         hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制全文'}
            </button>
          </div>

          {/* ① 会前洞察 */}
          <Section title="① 会前洞察" subtitle="10 分钟" color="blue">
            <SubBlock label="本周团契状态">
              {outline.ai_member_insight.problem_summary}
            </SubBlock>
            <SubBlock label="属灵定性">
              {outline.ai_member_insight.bible_framework}
            </SubBlock>
          </Section>

          {/* ② 经文原段 */}
          <Section title="② 经文原段" subtitle="宣读" color="amber">
            <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line italic">
                {outline.ai_sermon_lecture.scripture_text_full}
              </p>
              <p className="mt-2 text-[10px] text-amber-600/70">
                ⚠ 请对照实体圣经核实经文原文
              </p>
            </div>
          </Section>

          {/* ③ 讲道阐述 — 可折叠 */}
          <Section title="③ 讲道阐述" subtitle="30–45 分钟" color="stone">
            <div className="space-y-2">
              {outline.ai_sermon_lecture.theological_breakdown.map((section, i) => (
                <div key={i} className="rounded-xl border border-stone-100 overflow-hidden">
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                    className="flex w-full items-center justify-between px-4 py-2.5 bg-stone-50
                               hover:bg-stone-100 transition-colors text-left"
                  >
                    <span className="text-xs font-bold text-stone-700">
                      {i === 0 ? '引言' : i === 4 ? '结论呼召' : sectionTitles[i]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-stone-400 tabular-nums">
                        {section.length} 字
                      </span>
                      {expanded[i]
                        ? <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
                        : <ChevronDown className="h-3.5 w-3.5 text-stone-400" />}
                    </div>
                  </button>
                  {expanded[i] && (
                    <div className="px-4 py-3 bg-white">
                      <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                        {section}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Word count summary */}
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-stone-400">
                讲道部分合计约 {outline.ai_sermon_lecture.theological_breakdown.reduce((s, t) => s + t.length, 0)} 字
              </span>
            </div>
          </Section>

          {/* ④ 交通问题 */}
          <Section title="④ 交通问题" subtitle="小组分享" color="green">
            <div className="space-y-3">
              {outline.ai_sermon_lecture.application_questions.map((q, i) => (
                <div key={i} className="flex gap-3">
                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full
                                   bg-green-100 text-xs font-bold text-green-700">
                    {i + 1}
                  </span>
                  <p className="text-sm text-stone-700 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </Section>

          <p className="text-center text-[10px] text-stone-300">
            由麦穗喜乐 AI 备课助手生成 · {new Date(outline.generated_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Helper sub-components ─────────────────────────────────────────────────────

type ColorKey = 'blue' | 'amber' | 'stone' | 'green'
const COLOR_MAP: Record<ColorKey, string> = {
  blue:  'bg-blue-50 border-blue-100',
  amber: 'bg-amber-50 border-amber-100',
  stone: 'bg-stone-50 border-stone-100',
  green: 'bg-green-50 border-green-100',
}
const TITLE_COLOR: Record<ColorKey, string> = {
  blue:  'text-blue-700',
  amber: 'text-amber-700',
  stone: 'text-stone-700',
  green: 'text-green-700',
}

function Section({
  title, subtitle, color = 'stone', children,
}: {
  title: string; subtitle?: string; color?: ColorKey; children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${COLOR_MAP[color]}`}>
      <div className="flex items-center gap-2 mb-3">
        <p className={`text-xs font-bold ${TITLE_COLOR[color]}`}>{title}</p>
        {subtitle && <span className="text-[10px] text-stone-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function SubBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-stone-700 leading-relaxed">{children as string}</p>
    </div>
  )
}
