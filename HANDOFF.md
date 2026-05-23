# 麦穗喜乐 (MaisuiJoy) — 全程开发移交文档

> 生成日期：2026-05-19  
> 涵盖范围：项目初始化 → 当前生产版本完整开发历史

---

## 一、项目基础信息

| 项目 | 内容 |
|------|------|
| **中文名** | 麦穗喜乐 |
| **Slogan** | 麦穗喜乐 · 微光同行 |
| **根目录** | `C:\Users\jifen\maisui-joy` |
| **生产域名** | https://www.maisuijoy.com |
| **Vercel 项目名** | `maisuilife` |
| **GitHub (主)** | `Halfyears/maisui`（remote: `origin`） |
| **GitHub (Vercel监听)** | `Halfyears/maisuilife`（remote: `vercel-origin`） |
| **部署命令** | `git push origin main && git push vercel-origin main && npx vercel --prod` |
| **最后上线 commit** | `52256e2`（2026-05-19） |

---

## 二、技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 App Router（route groups: `(dashboard)` / `(auth)`） |
| 样式 | Tailwind CSS v3 · Shadcn UI (Neutral/Slate) |
| 背景色 | 燕麦色 `#F4F1EA` = `oklch(0.962 0.011 84.0)` |
| 主色 | 麦穗金 `#D4AF37` = `oklch(0.757 0.134 84.2)` |
| 数据库/认证 | Supabase PostgreSQL + RLS + Auth |
| AI 生成 | **Groq `llama-3.3-70b-versatile`**（当前主力）；Gemini 1.5 Flash 已弃用 |
| STT | Groq Whisper API |
| 加密 | AES-256-GCM（`lib/crypto.ts`，密文格式：`[IV(12)][Tag(16)][Ciphertext]`，存为 BYTEA） |
| 部署 | Vercel Node.js runtime（非 Edge） |

---

## 三、三条物理隐私红线（不可违反）

1. **音销字留**：`audioBuffer.fill(0); audioBuffer = null`，在 `try/finally` 块中完成，原始音频永不落盘
2. **午夜洗净**：pg_cron UTC 16:00（= CST 00:00）将 `daily_alignments.is_visible` 置 FALSE
3. **匿名同行**：团契 feed 只显示 `layer2_label` + `status_tag`，未提交当日分享前内容全部模糊

---

## 四、环境变量（必须在 Vercel Dashboard 配置）

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY              ← createAdminClient() 专用
GROQ_API_KEY                           ← Whisper STT + llama-3.3-70b-versatile
GEMINI_API_KEY                         ← 备用（部分引用仍存在）
NEXT_PUBLIC_GEMINI_API_KEY
ENCRYPTION_KEY                         ← 32字节hex，AES-256-GCM
NEXT_PUBLIC_SITE_URL                   ← https://www.maisuijoy.com
CLOUDFLARE_TURNSTILE_SECRET_KEY
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
```

生成 ENCRYPTION_KEY：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 五、Supabase 数据库结构（全量）

```sql
-- 用户
users: id, display_name,
       role (member | group_leader | church_admin | super_admin),
       settings jsonb { elder_mode: bool },
       church_id

-- 团契
fellowships: id, invite_code (6位), name, leader_id, church_id,
             status (pending | approved | archived),
             meeting_address, leader_contact

-- 团契成员
fellowship_members: user_id, fellowship_id, layer2_label, status_tag

-- 今日内室
daily_alignments: user_id, mood, ai_summary_enc (AES-256-GCM 加密 BYTEA),
                  status_tag, layer2_label, is_silent, is_visible, created_at

-- 灵命成长日志
spiritual_logs: user_id, ai_comfort, bible_verse, created_at

-- 代祷
prayer_requests: id, requester_id, content, is_anonymous, is_silent
prayer_responses: request_id, responder_id, prayer_type (text | silent)

-- 同行小组
accountability_groups: id, name, convener_id, goal_type,
                       start_date, end_date, invite_code
accountability_group_members: group_id, user_id, role (convener | member)
accountability_checkins: group_id, user_id, checkin_date,
                         status (done | pending | missed)

-- 团契聚会
fellowship_sessions: id, fellowship_id,
                     state (checkin → harvest → closed),
                     expected_count, checkin_count, wheat_total,
                     scripture_cards jsonb, amen_count,
                     started_at, harvested_at
session_checkins: id, session_id, user_id, anon_label, checked_in_at

-- AI备课缓存（跨团契共享）
shared_outlines: id, meeting_type, input_query, query_normalized, tier,
                 outline jsonb, use_count, generated_at, last_used_at
                 UNIQUE (meeting_type, query_normalized, tier)

-- AI备课历史（团契专属）
fellowship_outlines: id, fellowship_id, created_by, meeting_type,
                     input_query, tier, outline jsonb, generated_at

-- 本周备课计划（投屏同步）
fellowship_session_plans: id, fellowship_id, theme, scripture_ref,
                          scripture_text, discussion_questions jsonb,
                          prayer_points jsonb, updated_at

-- 系统配置
system_configs: key, value jsonb
  -- keys: ai_circuit_breaker, church_name, global_notice, donation_config
```

### 关键 Postgres 函数（SECURITY DEFINER）

```sql
is_fellowship_leader(fid uuid) → bool
is_fellowship_member(fid uuid) → bool
current_user_role() → text
increment_wheat_count(p_fellowship_id uuid) → void   -- 原子递增签到数
increment_shared_use_count(p_id uuid) → void         -- 原子递增缓存使用次数
```

---

## 六、Supabase 客户端使用规则（关键）

| 客户端 | 场景 | 说明 |
|--------|------|------|
| `createClient()` | 客户端组件 | 使用用户 JWT，受 RLS 约束 |
| `createServerClient()` via `@supabase/ssr` | 服务端读用户 session | 仍受用户 JWT 的 RLS 约束 |
| `createAdminClient()` | **服务端特权写操作** | 真正绕过 RLS，使用 `@supabase/supabase-js` + service_role key，无 cookie |

> ⚠️ `createServiceClient()` ≠ `createAdminClient()`。前者通过 `@supabase/ssr` 仍读 cookie JWT，PostgREST 仍使用用户角色。所有需要绕过 RLS 的写操作必须用 `createAdminClient()`。

---

## 七、核心架构注意事项（血泪经验）

### ① Vercel Serverless 铁律

```
return 之前必须 await 所有 DB 写操作
fire-and-forget .then() 在 return 后永远不会执行！

✅ 正确写法：
await Promise.allSettled([
  db.from('table_a').insert(...),
  db.from('table_b').upsert(...),
])
return NextResponse.json({ ... })
```

### ② Groq 中文 Token 估算

```
中文 ≈ 1.5–2 token/字
一个完整中文 JSON 响应轻易达到 3000–6000 token
max_tokens 设置：premium = 8000，free = 4500
response_format: { type: 'json_object' } 若被截断会抛 JSON.parse 异常
scripture_text_full 只取核心 3–5 节，不输出整章（整章罗马书8章≈3000 token）
```

### ③ Groq Whisper iOS 兼容

```
iOS Safari 录音 MIME 类型为 audio/mp4
Groq Whisper 根据文件扩展名识别编解码，不看 MIME

❌ new File([blob], 'voice.webm')   ← iOS 录音用此名会失败
✅ new File([blob], 'voice.mp4')    ← 检测到 audio/mp4 时用此名

sampleRate: 16000 在 iOS 上触发 OverconstrainedError，必须去掉
```

### ④ Groq 客户端初始化位置

```ts
// ❌ 错误：模块顶层初始化在 Next.js 构建时验证环境变量，导致 build 失败
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ✅ 正确：在 handler 内部初始化
export async function POST(req: NextRequest) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  // ...
}
```

### ⑤ RLS 无限递归

```
fellowships 的成员读策略 → 查 fellowship_members
fellowship_members 的自读策略 → 查回 fellowships
→ PostgREST 栈溢出崩溃

解决：创建 SECURITY DEFINER 辅助函数隔断递归
is_fellowship_leader() / is_fellowship_member() / current_user_role()
```

### ⑥ 组长 ≠ 团契成员

```
fellowships.leader_id 和 fellowship_members.user_id 是两张独立表
组长可能不在 fellowship_members 里！

任何鉴权检查必须：
const [{ data: member }, { data: asLeader }] = await Promise.all([
  db.from('fellowship_members').eq('user_id', userId).eq('fellowship_id', fid).maybeSingle(),
  db.from('fellowships').eq('leader_id', userId).eq('id', fid).maybeSingle(),
])
if (!member && !asLeader) return 403
```

### ⑦ useSearchParams 陷阱

```
login 页若用 useSearchParams() 而不包在 <Suspense>：
→ 全站所有服务端组件 SSR pipeline 崩溃（Error Digest 3227098399）

解决：
// app/(auth)/login/page.tsx → server component
export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginForm />
    </Suspense>
  )
}
// LoginForm 是 'use client' 组件，内部才用 useSearchParams()
```

### ⑧ 服务端组件不能 self-HTTP

```
// ❌ 错误：server component 通过 fetch 调用自身 API 路由
const res = await fetch('/api/fellowship/posts')

// ✅ 正确：直接在 server component 中调用 Supabase
const { data } = await db.from('fellowship_members').select(...)
```

### ⑨ 时区问题

```
服务端 new Date().toISOString().slice(0,10) 返回 UTC 日期
中国用户 00:00–07:59 CST 之间提交，日期会错一天

解决：
1. ClientDateSync 组件（'use client'）在 useEffect 中写 cookie：
   document.cookie = `localDate=${new Date().toLocaleDateString('en-CA')}`
2. 服务端 todayLocal() 读取该 cookie
3. 回退值：Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
```

---

## 八、功能模块全览

### 1. 今日内室 (`/daily`)

- 情绪选择（5种状态 + emoji 徽章）→ 文字输入 OR 语音录入
- 提交流程：Groq Whisper STT → Groq LLM 生成圣经回应 → AES-256-GCM 加密 → 存库
- 长辈模式：全局字体放大（`components/elder-mode-wrapper.tsx`）

**AI 回应铁律：**
- 必须使用和合本原文（含精确章节号）
- **严禁**以神的口吻说话（不能说"我听到了"，应说"神都知道了，你的呼求神都听见了"）
- **严禁**编造或改写圣经经文
- 第一段必须镜像用户输入的关键词

### 2. 团契 (`/fellowship`)

- Feed 显示 `layer2_label` + `status_tag`，未提交当日分享的用户看到模糊内容（含 is_silent 静默条目）
- 代祷请求：文字代祷 + 隐名代祷（按钮等大，靛蓝色）
- Super_admin 可为自己代祷，其他人不行
- Groq 牧养洞察：读3天 `status_tag` 分布，生成100字温暖建议

### 3. 灵命成长 (`/growth`)

- 反时序琥珀色卡片
- `revalidate = 0`（禁止缓存，避免 stale data）

### 4. 同行小组 (`/accountability`)

- **任何人**均可创建（不限组长）
- 召集人称"召集人"（非组长），角色名 `convener`
- 可跨团契成员加入
- ICS 日历导出（`America/Los_Angeles` 时区 RRULE，无 UTC 漂移）
- 自定义目标类型，支持内联编辑

### 5. 团契聚会签到 + 投屏

**签到状态机：** `checkin → harvest → closed`

**完整流程：**
1. 组长开启签到，输入预期人数 N → POST `/api/fellowship/session/start`
2. 成员签到 → 原子递增 `checkin_count`（`increment_wheat_count` RPC）
3. 投屏蜡烛矩阵轮询（2–3秒）：N-1人 = 85% 进度；N人 = 100% 爆炸动画
4. 触发丰收 → POST `/api/fellowship/session/harvest`：
   - AI 生成3张经文卡片（scripture_cards jsonb）
   - `wheat_total` 补齐逻辑：若 `< expected_count × 4`，补至 `expected_count × random(4,6)`
   - 丰收画面：阿们按钮含 `navigator.vibrate(50)` 震动反馈
5. 结束聚会 → POST `/api/fellowship/session/close`
6. 退出投屏：返回 `/fellowship/console?id=${fellowshipId}`（不是选择页）

**鉴权修复（已上线）：**
- `/api/fellowship/session/current` 同时检查 `fellowship_members.user_id` OR `fellowships.leader_id`

### 6. AI备课工作台 (`/fellowship/console`)

**两种模式：**
- 主题查经（输入主题词）
- 经文查经（输入章节，如"罗马书8章"）

**两个档位：**

| 档位 | 触发条件 | 目标字数 | max_tokens |
|------|---------|---------|-----------|
| `free` | 默认所有用户 | 600–800字 | 4500 |
| `premium` | `role = 'super_admin'` | 3000+字 | 8000 |

- Super_admin 在备课台显示「⚡ 超管测试」紫色徽章
- 免费用户在结果下方显示升级引导卡片

**AI 三铁律：**
1. 第一段必须镜像用户关键词
2. 使用和合本原文，含精确章节号
3. 细腻上下文编织（不说大话套话）

**共享缓存机制：**
```
shared_outlines 表
唯一键：(meeting_type, query_normalized, tier)
query_normalized = input_query.trim().toLowerCase().replace(/\s+/g, ' ')
命中缓存 → 直接写 fellowship_outlines + 原子递增 use_count → 不调用 Groq
```

**输出 JSON 结构：**
```json
{
  "title": "...",
  "core_message": "...",
  "scripture_text_full": "（仅核心3-5节，不输出整章）",
  "theological_breakdown": ["...", "...", "..."],
  "discussion_questions": ["...", "...", "..."],
  "prayer_points": ["...", "..."],
  "practical_application": "..."
}
```

**历史记录：**
- 存入 `fellowship_outlines`，最近8条可在侧边栏查看并一键恢复
- 历史读取接口：`GET /api/fellowship/outlines?fellowship_id=xxx`

### 7. 投屏备课同步

- `fellowship_session_plans` 表存当周备课内容
- `PUT /api/fellowship/session-plan` — 全量更新（空/空白字段存为 null）
- `DELETE /api/fellowship/session-plan` — 清空投屏（备课台两次确认后调用）

### 8. 用户权限体系

```
super_admin   → /admin/hub（系统配置、AI熔断开关、费用监控）
church_admin  → /church/hub（教会管理、团契审批、成员角色编辑）
group_leader  → /fellowship/console（备课工作台、聚会签到、牧养洞察）
member        → 基础使用（今日内室、团契、灵命成长、同行小组）
```

> ⚠️ 所有需要 `church_admin` 权限的页面也必须允许 `super_admin` 访问

### 9. 教会 Hub (`/church/hub`)

- 教会名称编辑（存 `system_configs`，保存后 header 实时刷新）
- 团契管理：名称/组长/状态内联编辑
- 成员角色编辑
- 新建团契入口在此页（不在其他页面）

### 10. 超管 Hub (`/admin/hub`)

- DevOps 监控：费用计算器、AI 熔断开关（`system_configs.ai_circuit_breaker`）
- 系统配置编辑器（`system_configs` 表），配置键中文显示名
- 金融业务：纯文字/散文展示（不显示 JSON 或代码格式）

### 11. 奉献模块

- AI 生成3种标题/文案（可刷新）
- 金额选项：10 / 20 / 50 / 自定义
- 支付渠道：Zelle / Venmo / PayPal（无微信/支付宝，跨境汇款合规问题）
- 命名避免"奉献"合规风险，改用"支持开发"等表述

### 12. 设置中心 (`/settings`)

- 个人名片：展示所属教会/团契/同行小组（各含跳转链接）
- 长辈模式开关：全局字体放大

### 13. Auth 系统

- Google OAuth（PKCE 流程）+ Apple OAuth（iOS/Safari 专用）
- Magic link（邮件）
- 传统邮箱+密码
- Cloudflare Turnstile 防刷 + Honeypot 蜜罐字段
- 新用户注册后跳转 `/`（不是 `/daily`）
- 回调路由：`/api/auth/callback?code=` 或 `?token_hash=&type=magiclink`

### 14. PWA

- `app/manifest.ts` — MetadataRoute.Manifest
- `app/icon.tsx` — Edge Runtime ImageResponse（麦穗logo，琥珀色，88→128px）
- `app/apple-icon.tsx`
- `public/sw.js` — Service Worker，处理推送通知
- 推送计划：每周日 9:00「主日灵命成长报告」；每月1日 9:30「每月灵命成长报告」

---

## 九、导航架构

```
底部导航（5标签）：首页 · 今日内室 · 团契 · 灵命成长 · 同行小组

所有页面 header 右侧按钮统一为"首页"
返回首页按钮文字：始终用"首页"，不用"主大盘"、"返回"等其他表述
```

### 关键路由

```
/                               首页/主大盘
/daily                          今日内室
/fellowship                     团契列表
/fellowship/create              创建团契
/fellowship/console?id=xxx      组长控制台 + 备课工作台
/fellowship/console/projector?id=xxx   投屏模式
/growth                         灵命成长时间线
/accountability                 同行小组
/settings                       设置中心
/church/hub                     教会管理后台
/admin/hub                      超管后台
/auth/login                     登录
/auth/signup                    注册
/api/auth/callback              OAuth / Magic link 回调
```

---

## 十、核心文件清单

```
app/
├── (dashboard)/
│   ├── daily/page.tsx                        今日内室页
│   ├── fellowship/
│   │   ├── page.tsx                          团契 feed（直接 Supabase 查询，非 self-HTTP）
│   │   ├── create/page.tsx                   创建团契
│   │   └── console/
│   │       ├── page.tsx                      组长控制台（传 userRole 给 StudyWorkbench）
│   │       └── projector/
│   │           ├── page.tsx                  投屏入口
│   │           └── projector-slides.tsx      投屏幻灯片（ExitButton 传 fellowshipId）
│   ├── growth/page.tsx                       灵命成长
│   ├── accountability/page.tsx               同行小组
│   ├── church/hub/page.tsx                   教会管理
│   ├── admin/hub/page.tsx                    超管后台
│   └── settings/page.tsx                     设置中心
├── (auth)/
│   └── login/page.tsx                        登录（server component + <Suspense>）
└── api/
    ├── stt/route.ts                          Groq Whisper STT
    ├── align/route.ts                        文字提交 bypass STT
    ├── auth/callback/route.ts                OAuth / Magic link 回调
    └── fellowship/
        ├── posts/route.ts                    团契 feed（含隐私遮罩）
        ├── insight/route.ts                  Groq 牧养洞察
        ├── outline/route.ts                  AI 备课生成（双档 + 共享缓存）
        ├── outlines/route.ts                 历史备课列表（GET，最近8条）
        ├── session-plan/route.ts             PUT 全量更新 + DELETE 清空投屏
        └── session/
            ├── current/route.ts              当前聚会状态（已修复 leader 鉴权）
            ├── start/route.ts                开启签到
            ├── harvest/route.ts              触发丰收
            ├── close/route.ts                结束聚会
            └── amen/route.ts                 阿们计数

components/
├── console/
│   ├── study-workbench.tsx                   备课工作台（主题+经文+历史+清空投屏）
│   └── session-panel.tsx                     签到面板（含 startErr 错误处理）
├── daily/
│   ├── daily-form.tsx                        今日内室表单
│   └── voice-recorder.tsx                    iOS 兼容录音组件
└── elder-mode-wrapper.tsx                    全局长辈模式字体放大

lib/
├── crypto.ts                                 AES-256-GCM 加密/解密
├── supabase/
│   ├── server.ts                             createClient / createAdminClient
│   └── client.ts                            浏览器端 client
└── ai/
    ├── whisper.ts                            Groq Whisper（handler 内初始化）
    └── gemini.ts                             Gemini（备用，现主要用 Groq）

supabase/
├── migrations/
│   ├── 001_schema.sql                        基础表结构
│   ├── 002_rls.sql                           RLS 策略
│   ├── 003_cron.sql                          pg_cron 安全定时任务
│   └── 007_security_definer.sql             辅助函数（is_fellowship_leader 等）
├── fellowship_outlines.sql                   备课历史表（已执行）
└── shared_outlines.sql                       共享缓存表 + increment 函数（已执行）

public/
└── sw.js                                     Service Worker（推送通知）
```

---

## 十一、历史重大 Bug 完整记录

| Bug | 根因 | 解决方案 |
|-----|------|---------|
| Error Digest 3227098399（持续全站崩溃） | login 页 `useSearchParams()` 无 `<Suspense>` 包裹，污染全站 SSR pipeline | login 改为 server component，`<LoginForm>` 包 `<Suspense fallback>` |
| 全站 CSS 归零/样式丢失 | `tailwindcss-animate` 在 plugins[] 但未安装；`tw-animate-css` 是 v4 专用，与 v3 不兼容 | 移除 plugin 引用，修正 `@import` |
| `createServiceClient()` 不绕过 RLS | `@supabase/ssr` 读 cookie JWT，PostgREST 仍用用户角色 | 改用 `createAdminClient()`（直接 createClient + service_role，无 cookie） |
| RLS 无限递归崩溃 | `fellowships` ↔ `fellowship_members` 策略相互查询 | SECURITY DEFINER 辅助函数隔断递归 |
| iOS 所有录音失败 | `sampleRate:16000` → OverconstrainedError；Groq 看文件扩展名不看 MIME | 去掉 sampleRate；iOS `audio/mp4` → `new File([blob], 'voice.mp4')` |
| Gemini API 404 | `gemini-1.5-flash` 已弃用 | 全面切换至 Groq `llama-3.3-70b-versatile` |
| Gemini 429 配额耗尽 | 免费 tier 额度不足 | 换新 API Key；改用 Groq |
| 灵命成长页面空白 | `revalidate = 60` 缓存 + 服务端 UTC 时区导致日期错一天 | `revalidate = 0` + ClientDateSync cookie 方案 |
| 团契 feed 服务端崩溃 | Server component 通过 HTTP 调用自身 API（self-referential fetch） | 改为直接 Supabase 查询 |
| 构建失败（Groq 模块） | 模块顶层 `new Groq()` 在构建时验证环境变量 | 移至 handler 内部初始化 |
| theological_breakdown 始终为空 | `max_tokens: 2000` 不足，中文 JSON 在抵达 breakdown 前耗尽预算 | 提升至 4500/8000；加 `filter(Boolean)` 检测；空则返回 `ai_incomplete_output` error |
| 备课历史未保存（Vercel 丢写） | `return` 后 `.then()` 回调被 serverless 终止 | 改为 `await Promise.allSettled([...])` 后再 return |
| 经文查经生成失败 | typeHint 要求整章经文（罗马书8章≈3000 token）耗尽预算 | typeHint 改为「只取核心3–5节」；systemPrompt 同步限制 |
| 开始团契无反应（静默失败） | `/api/fellowship/session/current` 只检查 `fellowship_members`，组长不在表中 → 403；`startSession()` 无错误处理 | 同时检查 `fellowships.leader_id`；前端加 `res.ok` 检查 + 红字提示 |
| 退出投屏返回选择页 | `ExitButton` href 硬编码 `/fellowship/console`（无 id 参数） | 传入 `fellowshipId` prop，改为 `/fellowship/console?id=${fellowshipId}` |
| 同行小组创建后重定向空页 | 路由使用 `createServiceClient()` 而非 `createAdminClient()` | 所有 accountability API 路由改用 `createAdminClient()` |
| 团契加入 404 | 路由路径错误；middleware 丢弃 `?code=` 参数 | 修正路由；middleware 保留 pathname + search |

---

## 十二、AI 备课功能详细规格

### 档位判断逻辑

```ts
type OutlineTier = 'free' | 'premium'
const tier: OutlineTier = profile.role === 'super_admin' ? 'premium' : 'free'
```

### 共享缓存查询

```ts
const queryNormalized = input_query.trim().toLowerCase().replace(/\s+/g, ' ')
const { data: cached } = await db
  .from('shared_outlines')
  .select('id, outline, use_count')
  .eq('meeting_type', meeting_type)
  .eq('query_normalized', queryNormalized)
  .eq('tier', tier)
  .maybeSingle()

if (cached) {
  await Promise.allSettled([
    db.rpc('increment_shared_use_count', { p_id: cached.id }),
    db.from('fellowship_outlines').insert({ ... }),
  ])
  return NextResponse.json({ outline: cached.outline, from_cache: true })
}
```

### Groq 调用参数

```ts
const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  response_format: { type: 'json_object' },
  max_tokens: tier === 'premium' ? 8000 : 4500,
  temperature: 0.7,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
})
```

### 生成后处理

```ts
const parsed = JSON.parse(completion.choices[0].message.content!)
const breakdown = (parsed.theological_breakdown ?? []).filter(Boolean)
if (!breakdown.length) {
  return NextResponse.json({ error: 'ai_incomplete_output' }, { status: 500 })
}

// 写库（必须 await，不能 fire-and-forget）
await Promise.allSettled([
  db.from('shared_outlines').upsert({ ... }, { ignoreDuplicates: true }),
  db.from('fellowship_outlines').insert({ ... }),
])
```

---

## 十三、最新上线状态（2026-05-19，commit 52256e2）

### 本轮修复内容

| 问题 | 修复文件 | 修复内容 |
|------|---------|---------|
| 退出投屏回到选择页 | `projector-slides.tsx` | `ExitButton` 接收 `fellowshipId` prop，href → `/fellowship/console?id=xxx` |
| 开始团契组长403 | `session/current/route.ts` | 同时检查 `fellowship_members` OR `fellowships.leader_id` |
| 开始团契无错误提示 | `session-panel.tsx` | 检查 `res.ok`，失败显示「开启签到失败，请重试」红字 |

### 已知可关注点（非阻塞）

- Premium 付费解锁机制：UI 引导卡已就位，`tier` 逻辑已实现，仅差付费验证逻辑
- 投屏签到蜡烛矩阵的 `anon_label` 标签目前为匿名，可考虑改为昵称首字
- 历史备课支持删除单条（目前只能恢复，不能删除）
- 部分 Gemini 引用可能仍存在于非核心路径

---

*本文档由 Claude 于全程开发结束时自动汇总生成，可作为新会话的首条上下文直接粘贴使用。*
