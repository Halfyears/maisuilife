// ── Status Tags ──────────────────────────────────────────────────────────────
export const STATUS_TAGS = [
  { value: '感恩' as const, label: '感恩', emoji: '🙏', hint: '心怀谢意，有话要说' },
  { value: '平安' as const, label: '平安', emoji: '🕊️', hint: '内心安稳，静静同行' },
  { value: '疲惫' as const, label: '疲惫', emoji: '🌙', hint: '身心俱乏，需要歇息' },
  { value: '干渴' as const, label: '干渴', emoji: '🌿', hint: '灵里空乏，渴慕充满' },
  { value: '混乱' as const, label: '混乱', emoji: '🌊', hint: '思绪纷乱，等待平静' },
] as const

export type StatusTagValue = typeof STATUS_TAGS[number]['value']

// ── Scripture Bank ────────────────────────────────────────────────────────────
// 10 精选经文，供 AI 按心境匹配。格式：{ mood, text, ref }
// mood 对应 STATUS_TAGS value，'通用' 适合任何心境
export const SCRIPTURE_BANK = [
  {
    mood: '感恩',
    text: '应当凡事谢恩；因为这是神在基督耶稣里向你们所定的旨意。',
    ref: '帖撒罗尼迦前书 5:18',
  },
  {
    mood: '感恩',
    text: '你们要以感谢为祭献给神，又要向至高者还你的愿。',
    ref: '诗篇 50:14',
  },
  {
    mood: '平安',
    text: '你们要将一切的忧虑卸给神，因为他顾念你们。',
    ref: '彼得前书 5:7',
  },
  {
    mood: '平安',
    text: '神所赐出人意外的平安，必在基督耶稣里保守你们的心怀意念。',
    ref: '腓立比书 4:7',
  },
  {
    mood: '疲惫',
    text: '凡劳苦担重担的人可以到我这里来，我就使你们得安息。',
    ref: '马太福音 11:28',
  },
  {
    mood: '疲惫',
    text: '他赐力量给疲乏的人，加添精力给软弱的人。',
    ref: '以赛亚书 40:29',
  },
  {
    mood: '干渴',
    text: '口渴的人也当来；愿意的，都可以白白取生命的水喝。',
    ref: '启示录 22:17',
  },
  {
    mood: '干渴',
    text: '神啊，你是我的神，我要切切地寻求你；在干旱疲乏无水之地，我渴想你。',
    ref: '诗篇 63:1',
  },
  {
    mood: '混乱',
    text: '你要专心仰赖耶和华，不可倚靠自己的聪明，在你一切所行的事上都要认定他，他必指引你的路。',
    ref: '箴言 3:5-6',
  },
  {
    mood: '混乱',
    text: '我往何处去躲避你的灵？我往何处逃、躲避你的面？……你的右手也必扶持我。',
    ref: '诗篇 139:7,10',
  },
  {
    mood: '通用',
    text: '耶和华是我的牧者，我必不至缺乏。',
    ref: '诗篇 23:1',
  },
  {
    mood: '通用',
    text: '我靠着那加给我力量的，凡事都能做。',
    ref: '腓立比书 4:13',
  },
] as const

// ── Numeric limits ────────────────────────────────────────────────────────────
export const JOURNEY_TTL_DAYS      = 7
export const AI_SUMMARY_MAX_CHARS  = 140
export const AI_COMFORT_MAX_CHARS  = 60
export const INVITE_CODE_LENGTH    = 6
export const MAX_THEME_TAGS        = 5

// ── Audio recording constraints ───────────────────────────────────────────────
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
}
export const MAX_RECORDING_SECONDS = 120
