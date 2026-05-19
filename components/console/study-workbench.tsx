'use client'

/**
 * 备课工作台 — AI备课 + 投屏同步 + 历史记录
 *
 * 流程：输入主题/经文 → AI 生成大纲 → 一键同步到投屏
 * 历史记录：每次生成自动保存，可一键恢复
 */

import { useState, useTransition, useEffect } from 'react'
import {
  BookOpen, Sparkles, Loader2, Copy, Check,
  ChevronDown, ChevronUp, CheckCircle2, Monitor, Lock,
  History, RotateCcw, Trash2, AlertCircle,
} from 'lucide-react'
import type { MeetingOutline } from '@/app/api/fellowship/outline/route'
import type { OutlineRecord } from '@/app/api/fellowship/outlines/route'

interface Props {
  fellowshipId:         string
  userRole:             string
  initialTheme:         string | null
  initialScriptureRef:  string | null
  initialScriptureText: string | null
  moodWords:            string[]
}

export function StudyWorkbench({
  fellowshipId,
  userRole,
  initialTheme,
  initialScriptureRef,
  initialScriptureText,
  moodWords,
}: Props) {
  const isSuperAdmin = userRole === 'super_admin'

  // ── AI generation state ──────────────────────────────────────────────────
  const [meetingType, setMeetingType] = useState<'theme' | 'scripture'>('theme')
  const [query, setQuery]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [outline, setOutline]         = useState<MeetingOutline | null>(null)
  const [genError, setGenError]       = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const [expanded, setExpanded]       = useState<Record<number, boolean>>({})

  // ── Projector sync state ─────────────────────────────────────────────────
  const [syncTheme,   setSyncTheme]   = useState(initialTheme         ?? '')
  const [syncRef,     setSyncRef]     = useState(initialScriptureRef  ?? '')
  const [syncText,    setSyncText]    = useState(initialScriptureText ?? '')
  const [isSaving,    startSave]      = useTransition()
  const [saved,       setSaved]       = useState(false)
  const [isClearing,  startClear]     = useTransition()
  const [cleared,     setCleared]     = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // ── History state ────────────────────────────────────────────────────────
  const [history,        setHistory]        = useState<OutlineRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyOpen,    setHistoryOpen]    = useState(false)

  // Current projector badge
  const hasCurrentPlan = !!(initialTheme || initialScriptureRef)

  // ── Load history on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/fellowship/outlines?fellowship_id=${fellowshipId}&limit=8`)
      .then(r => r.ok ? r.json() : [])
      .then((records: OutlineRecord[]) => setHistory(records))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [fellowshipId])

  // Refresh history after new generation
  function refreshHistory() {
    fetch(`/api/fellowship/outlines?fellowship_id=${fellowshipId}&limit=8`)
      .then(r => r.ok ? r.json() : [])
      .then((records: OutlineRecord[]) => setHistory(records))
      .catch(() => {})
  }

  // ── AI generation ────────────────────────────────────────────────────────
  async function generate() {
    if (!query.trim() || loading) return
    setLoading(true)
    setGenError(null)
    setOutline(null)
    setSaved(false)

    try {
      const res = await fetch('/api/fellowship/outline', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fellowship_id: fellowshipId,
          meeting_type:  meetingType,
          input_query:   query.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setGenError(data.error === 'ai_not_configured' ? 'AI 服务未配置' : '生成失败，请稍后重试')
        return
      }
      const data: MeetingOutline = await res.json()
      setOutline(data)
      // Auto-fill projector sync fields from AI result
      setSyncTheme(query.trim())
      setSyncRef(data.ai_sermon_lecture.scripture_ref || syncRef)
      setSyncText(data.ai_sermon_lecture.scripture_text_full || syncText)
      // Expand all sections
      setExpanded({ 0: true, 1: true, 2: true, 3: true, 4: true })
      // Refresh history list
      refreshHistory()
    } catch {
      setGenError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── Restore from history ─────────────────────────────────────────────────
  function restoreFromHistory(record: OutlineRecord) {
    setOutline(record.outline)
    setQuery(record.input_query)
    setMeetingType(record.meeting_type)
    setSyncTheme(record.input_query)
    setSyncRef(record.outline.ai_sermon_lecture.scripture_ref || '')
    setSyncText(record.outline.ai_sermon_lecture.scripture_text_full || '')
    setExpanded({ 0: true, 1: true, 2: true, 3: true, 4: true })
    setSaved(false)
    setHistoryOpen(false)
    // Scroll to top of section
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Projector sync ───────────────────────────────────────────────────────
  function handleSave() {
    setSaved(false)
    startSave(async () => {
      await fetch('/api/fellowship/session-plan', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fellowship_id:  fellowshipId,
          theme:          syncTheme,
          scripture_ref:  syncRef,
          scripture_text: syncText,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  // ── Clear projector ──────────────────────────────────────────────────────
  function handleClearProjector() {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    setConfirmClear(false)
    setCleared(false)
    startClear(async () => {
      await fetch('/api/fellowship/session-plan', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fellowship_id: fellowshipId }),
      })
      setSyncTheme('')
      setSyncRef('')
      setSyncText('')
      setCleared(true)
      setTimeout(() => setCleared(false), 3000)
    })
  }

  // ── Copy full outline text ───────────────────────────────────────────────
  function buildFullText(): string {
    if (!outline) return ''
    const { ai_member_insight: ins, ai_sermon_lecture: ser } = outline
    const typeLabel = outline.meeting_type === 'theme' ? '主题查经' : '经文查经'
    return [
      `【${typeLabel}备课大纲】${outline.input_query}`,
      '',
      '── 会前洞察 ──',
      `▌ 本周团契状态\n${ins.problem_summary}`,
      `▌ 属灵定性\n${ins.bible_framework}`,
      '',
      `── 经文原段（${ser.scripture_ref}）──`,
      ser.scripture_text_full,
      '',
      '── 讲道阐述（30-45分钟）──',
      ...ser.theological_breakdown,
      '',
      '── 交通问题 ──',
      ...ser.application_questions.map((q, i) => `Q${i + 1}. ${q}`),
      '',
      `（由麦穗喜乐 AI 备课助手生成 · ${new Date(outline.generated_at).toLocaleString('zh-CN')}）`,
    ].join('\n\n')
  }

  async function copyAll() {
    await navigator.clipboard.writeText(buildFullText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-stone-100 bg-white/90 shadow-md shadow-amber-900/5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-stone-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
          <BookOpen className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-stone-900">备课工作台</h3>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 border border-violet-200
                               px-2 py-0.5 text-[10px] font-bold text-violet-700">
                ⚡ 超管测试
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            {isSuperAdmin
              ? 'AI 完整讲章（3000字）· 一键同步到投屏'
              : 'AI 讲章纲要 · 一键同步到投屏'}
          </p>
        </div>
        {/* Current projector state badge */}
        {hasCurrentPlan && (
          <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-100 px-2.5 py-1">
            <Monitor className="h-3 w-3 text-stone-400" />
            <span className="text-[10px] text-stone-400 max-w-[90px] truncate">
              {initialTheme || initialScriptureRef}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* ── Step 1: Input ──────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">① 输入本周主题</p>

          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-stone-200 text-xs font-medium">
            {(['theme', 'scripture'] as const).map(t => (
              <button key={t} onClick={() => setMeetingType(t)}
                className={`flex-1 py-2 transition-colors ${
                  meetingType === t ? 'bg-amber-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
                }`}>
                {t === 'theme' ? '📖 主题查经' : '📜 经文查经'}
              </button>
            ))}
          </div>

          {/* Mood word chips */}
          {moodWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {moodWords.map(w => (
                <button key={w} type="button"
                  onClick={() => setQuery(q => q ? `${q}、${w}` : w)}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1
                             text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                  {w}
                </button>
              ))}
              <span className="self-center text-[10px] text-stone-300">← 本周成员心境（点击可加入）</span>
            </div>
          )}

          {/* Query + generate */}
          <div className="flex gap-2">
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder={meetingType === 'theme' ? '如：职场诚实、饶恕与和好、恩典够用' : '如：罗马书8章、诗篇23篇'}
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm
                         text-stone-900 placeholder:text-stone-300
                         focus:border-amber-400 focus:bg-white focus:outline-none transition-colors"
            />
            <button onClick={generate} disabled={loading || !query.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5
                         text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shrink-0">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />生成中…</>
                : <><Sparkles className="h-4 w-4" />AI 备课</>}
            </button>
          </div>
          {genError && <p className="text-xs text-red-500">{genError}</p>}
        </div>

        {/* ── Loading skeleton ─────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3 py-2">
            {[80, 60, 100, 90, 75].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-stone-100" />
                <div className="h-2.5 animate-pulse rounded bg-stone-100" style={{ width: `${w}%` }} />
                <div className="h-2.5 w-11/12 animate-pulse rounded bg-stone-100" />
              </div>
            ))}
            <p className="text-center text-xs text-stone-400 animate-pulse pt-1">
              {isSuperAdmin
                ? 'AI 研读经文、编织完整讲章，约需 20-40 秒…'
                : 'AI 生成讲章纲要，约需 10-20 秒…'}
            </p>
          </div>
        )}

        {/* ── Step 2: Outline result ─────────────────────────────── */}
        {outline && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">② 讲章大纲</p>
              <button onClick={copyAll}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white
                           px-3 py-1.5 text-xs font-medium text-stone-500
                           hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? '已复制' : '复制全文'}
              </button>
            </div>

            {/* Member insight */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3.5 space-y-3">
              <p className="text-xs font-bold text-blue-700">① 会前洞察 · 10 分钟</p>
              <SubBlock label="本周团契状态">{outline.ai_member_insight.problem_summary}</SubBlock>
              <SubBlock label="属灵定性">{outline.ai_member_insight.bible_framework}</SubBlock>
            </div>

            {/* Scripture */}
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-amber-700">② 经文原段 · 宣读</p>
                {outline.ai_sermon_lecture.scripture_ref && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    {outline.ai_sermon_lecture.scripture_ref}
                  </span>
                )}
              </div>
              <p className="text-sm text-stone-700 leading-relaxed italic whitespace-pre-line">
                {outline.ai_sermon_lecture.scripture_text_full}
              </p>
              <p className="mt-2 text-[10px] text-amber-600/70">⚠ 请对照实体圣经核实经文</p>
            </div>

            {/* Theological breakdown */}
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3.5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-stone-700">③ 讲道阐述 · 30–45 分钟</p>
                <div className="flex items-center gap-2">
                  {outline.tier === 'premium' && (
                    <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200
                                     px-2 py-0.5 rounded-full font-bold">⚡ 完整版</span>
                  )}
                  <span className="text-[10px] text-stone-400 tabular-nums">
                    合计 {outline.ai_sermon_lecture.theological_breakdown.reduce((s, t) => s + t.length, 0)} 字
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {outline.ai_sermon_lecture.theological_breakdown.map((section, i) => {
                  const labels = ['引言', '论点一', '论点二', '论点三', '结论呼召']
                  return (
                    <div key={i} className="rounded-lg border border-stone-200 overflow-hidden bg-white">
                      <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                        className="flex w-full items-center justify-between px-3.5 py-2.5
                                   hover:bg-stone-50 transition-colors text-left">
                        <span className="text-xs font-bold text-stone-700">{labels[i]}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400">{section.length} 字</span>
                          {expanded[i]
                            ? <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
                            : <ChevronDown className="h-3.5 w-3.5 text-stone-400" />}
                        </div>
                      </button>
                      {expanded[i] && (
                        <div className="px-3.5 pb-3 pt-1 border-t border-stone-100">
                          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{section}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Free tier upsell */}
              {outline.tier === 'free' && (
                <div className="mt-3 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100">
                      <Lock className="h-4 w-4 text-stone-400" />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-stone-700">完整讲章（3000字）</p>
                  <p className="mt-1 text-xs text-stone-400 leading-relaxed">
                    三维结构 · 总分总骨架 · 含具体场景、神学阐述和行动呼召<br />
                    可直接宣讲，适合 30–45 分钟聚会带领
                  </p>
                  <p className="mt-3 text-[10px] text-stone-300">即将推出付费版 · 敬请期待</p>
                </div>
              )}
            </div>

            {/* Application questions */}
            <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3.5">
              <p className="text-xs font-bold text-green-700 mb-3">④ 交通问题 · 小组分享</p>
              <div className="space-y-3">
                {outline.ai_sermon_lecture.application_questions.map((q, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full
                                     bg-green-100 text-xs font-bold text-green-700">{i + 1}</span>
                    <p className="text-sm text-stone-700 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Sync to projector ──────────────────────────── */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5 text-stone-500" />
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              ③ 同步到投屏
            </p>
            {outline && (
              <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 border border-amber-200
                               px-2 py-0.5 rounded-full">
                已从大纲自动填入
              </span>
            )}
          </div>

          {/* Theme */}
          <div>
            <label className="text-[11px] font-medium text-stone-400 mb-1 block">聚会主题（投屏显示）</label>
            <input
              value={syncTheme}
              onChange={e => setSyncTheme(e.target.value)}
              maxLength={80}
              placeholder="如：信心的根基、彼此相爱……"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm
                         text-stone-800 placeholder:text-stone-300
                         focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Scripture ref */}
          <div>
            <label className="text-[11px] font-medium text-stone-400 mb-1 block">经文章节</label>
            <input
              value={syncRef}
              onChange={e => setSyncRef(e.target.value)}
              placeholder="如：腓立比书 4:13"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm
                         text-stone-800 placeholder:text-stone-300
                         focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Scripture text */}
          {(syncText || syncRef) && (
            <div>
              <label className="text-[11px] font-medium text-stone-400 mb-1 block">经文全文（可编辑）</label>
              <textarea
                value={syncText}
                onChange={e => setSyncText(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm
                           text-stone-700 leading-relaxed resize-none
                           focus:border-amber-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving || (!syncTheme && !syncRef)}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
              saved
                ? 'border border-green-200 bg-green-50 text-green-700'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:opacity-90 disabled:opacity-40'
            }`}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saved    && <CheckCircle2 className="h-4 w-4" />}
            {!isSaving && !saved && <Monitor className="h-4 w-4" />}
            {saved ? '已同步到投屏 ✓' : '同步到投屏'}
          </button>

          {/* Clear projector button */}
          <button
            onClick={handleClearProjector}
            disabled={isClearing}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs
                        transition-all border ${
              cleared
                ? 'border-stone-200 bg-white text-stone-400'
                : confirmClear
                  ? 'border-red-300 bg-red-50 text-red-600 font-bold'
                  : 'border-stone-200 bg-white text-stone-400 hover:border-red-200 hover:text-red-500'
            }`}
          >
            {isClearing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : cleared
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : confirmClear
                  ? <AlertCircle className="h-3.5 w-3.5" />
                  : <Trash2 className="h-3.5 w-3.5" />}
            {cleared
              ? '投屏已清空'
              : confirmClear
                ? '再次点击确认清空投屏'
                : '清空投屏内容'}
          </button>

          <p className="text-[10px] text-stone-400 text-center">
            同步后投屏立即更新 · 聚会结束后请清空投屏
          </p>
        </div>

        {/* ── History Panel ───────────────────────────────────────── */}
        <div className="rounded-xl border border-stone-100 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="flex w-full items-center justify-between px-4 py-3
                       bg-stone-50 hover:bg-stone-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-stone-400" />
              <span className="text-xs font-bold text-stone-500">历史备课记录</span>
              {!historyLoading && history.length > 0 && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] text-stone-500 tabular-nums">
                  {history.length}
                </span>
              )}
            </div>
            {historyOpen
              ? <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
              : <ChevronDown className="h-3.5 w-3.5 text-stone-400" />}
          </button>

          {historyOpen && (
            <div className="divide-y divide-stone-50 bg-white">
              {historyLoading && (
                <div className="px-4 py-6 text-center">
                  <Loader2 className="h-4 w-4 animate-spin text-stone-300 mx-auto" />
                </div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-stone-300">
                  暂无历史记录 · 生成大纲后自动保存
                </div>
              )}
              {!historyLoading && history.map(record => (
                <div key={record.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs">{record.meeting_type === 'theme' ? '📖' : '📜'}</span>
                      <span className="text-xs font-medium text-stone-700 truncate">{record.input_query}</span>
                      {record.tier === 'premium' && (
                        <span className="shrink-0 text-[9px] text-violet-600 bg-violet-50 border border-violet-200
                                         px-1.5 py-0.5 rounded-full font-bold">⚡</span>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-400">
                      {new Date(record.generated_at).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      <span className="mx-1">·</span>
                      {record.outline.ai_sermon_lecture.theological_breakdown.reduce((s, t) => s + t.length, 0)} 字
                    </p>
                  </div>
                  <button
                    onClick={() => restoreFromHistory(record)}
                    className="shrink-0 ml-3 flex items-center gap-1 rounded-lg border border-stone-200
                               bg-white px-2.5 py-1.5 text-[10px] font-medium text-stone-500
                               hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function SubBlock({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-stone-700 leading-relaxed">{children}</p>
    </div>
  )
}
