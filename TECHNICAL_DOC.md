# 麦穗喜乐 — 技术文档

> 版本：v0.1 · 生成日期：2026-05-15  
> 适用读者：参与开发或运维的工程师

---

## 目录

1. [技术栈](#1-技术栈)
2. [项目结构](#2-项目结构)
3. [核心数据流](#3-核心数据流)
4. [隐私安全红线](#4-隐私安全红线)
5. [环境变量配置](#5-环境变量配置)
6. [数据库 Schema 概览](#6-数据库-schema-概览)
7. [管理员后台使用说明](#7-管理员后台使用说明)

---

## 1. 技术栈

| 层次 | 技术 | 版本 / 说明 |
|---|---|---|
| 框架 | Next.js App Router | 14.2.x，全程 Server Components + API Routes |
| 语言 | TypeScript | 5.6.x，strict mode |
| 样式 | Tailwind CSS + Shadcn/ui | oklch 色彩空间，自定义麦穗金 / 燕麦色主题 |
| 数据库 | Supabase (PostgreSQL) | RLS 行级安全 + pg_cron 定时任务 |
| 认证 | Supabase Auth | 密码登录 + Magic Link (OTP) |
| STT | Groq Whisper | `whisper-large-v3-turbo`，仅中文 (`language: 'zh'`) |
| AI 生成 | Google Gemini 1.5 Flash | 结构化 JSON 输出，`responseMimeType: 'application/json'` |
| 加密 | Node.js `crypto` | AES-256-GCM，应用层端到端加密 |
| 表单验证 | Zod | 用于所有 API 入参校验 |
| 图标 | Lucide React | 0.454.x |

### 运行时说明

- 所有涉及 `crypto` 或 `Buffer` 的 API Route 声明 `export const runtime = 'nodejs'`，避免 Edge Runtime 兼容问题。
- Supabase 客户端分两类：`createClient()`（anon key，受 RLS 约束）和 `createServiceClient()`（service_role，绕过 RLS，仅在受信任的服务端代码中使用）。

---

## 2. 项目结构

```
maisui-joy/
├── app/
│   ├── (auth)/login/          # 登录页（密码 / Magic Link）
│   ├── (dashboard)/
│   │   ├── daily/             # 今日内室（普通用户主页）
│   │   ├── fellowship/        # 团契页面
│   │   │   └── console/       # 组长后台（组长专用）
│   │   └── admin/hub/         # 管理员统一后台（super_admin 专用）
│   ├── (admin)/admin/hub/     # 旧版管理后台（保留兼容）
│   └── api/
│       ├── stt/               # 主入口：录音→STT→AI→落库
│       ├── fellowship/        # 团契相关（posts / react / silent / insight / settings）
│       ├── pastoral/          # 牧养穿透（list / request / approve）
│       └── admin/             # 管理接口（stats / config / circuit-breaker / create-fellowship）
├── components/
│   ├── admin/hub/             # 管理后台卡片组件
│   ├── console/               # 组长后台组件（pastoral-board / insight-card / spatial-toggle）
│   ├── daily/                 # 内室组件（daily-form / status-selector / voice-recorder）
│   └── fellowship/            # 团契组件
├── lib/
│   ├── ai/                    # gemini.ts / whisper.ts
│   ├── supabase/              # client.ts / server.ts（含 createServiceClient）
│   ├── crypto.ts              # AES-256-GCM encrypt / decrypt
│   └── constants.ts           # STATUS_TAGS / SCRIPTURE_BANK / 音频参数
├── supabase/migrations/       # 001_schema → 006_system_hub
├── types/index.ts             # 共享 TypeScript 类型 + Database 类型存根
└── middleware.ts              # 路由保护（auth / admin）
```

---

## 3. 核心数据流

### 3.1 今日内室（Daily Alignment）

```
用户端                          服务端 (POST /api/stt)
──────                          ──────────────────────
1. 选择心境标签 (StatusTag)
2. 按住录音按钮，MediaRecorder
   采集 audio/webm;codecs=opus
   (16kHz, 单声道, 最长120s)
3. 松开 → Blob 封装进 FormData
   字段：audio / status_tag /
         is_urgent / fellowship_id
4. fetch POST /api/stt ─────────▶ 0. Supabase Auth 验证 JWT
                                  0b. 检查 ai_circuit_breaker
                                      active=false → 返回 503
                                  1. 解析 multipart/form-data
                                  2. audioBuffer = Buffer.from(
                                       await audioFile.arrayBuffer())
                                  3. STT: Groq Whisper
                                       → rawTranscript
                                  ■ 音销A: audioBuffer.fill(0); null
                                  4. AI: Gemini 1.5 Flash
                                       → { comfort, verse, verse_ref,
                                           summary }
                                  ■ 音销B: rawTranscript = null
                                  5. encrypt(summary)
                                       → ai_summary_enc (BYTEA)
                                  6. upsert daily_alignments
                                       (user_id, date 唯一索引)
                                  7. (is_urgent) → flag_urgent RPC
                                  8. 返回 { alignmentId, comfort,
                                           verse, verse_ref }
                                  ■ finally: 再次确保 audioBuffer/
                                    rawTranscript 已清零
5. ◀───────────────────────────── 收到 AI 回应，显示安慰话语+经文
6. audioBlobRef.current = null   (客户端音销字留第四节点)
```

**关键文件：**
- `app/api/stt/route.ts` — 完整管道，含 4 个音销节点
- `lib/ai/whisper.ts` — Groq STT 封装
- `lib/ai/gemini.ts` — Gemini 结构化输出
- `lib/crypto.ts` — AES-256-GCM 加解密
- `components/daily/voice-recorder.tsx` — MediaRecorder UI

---

### 3.2 团契（Fellowship）

团契数据流的核心安全机制是**"交账解锁"**：查看者必须先提交当日内室，才能看到其他成员的 AI 摘要。

```
GET /api/fellowship/posts?fellowship_id=<uuid>
               │
               ▼
    ① 验证调用者是该团契成员
               │
               ▼
    ② 获取今日所有成员的 daily_alignments
       (含加密列 ai_summary_enc，但不传输)
               │
               ├── viewerHasSubmitted = alignments.some(a => a.user_id === me)
               │
    ③ 构建响应 posts[]
       ┌─ viewerHasSubmitted = false ──────────────────┐
       │  summary: null (加密字节绝不传输，连 null 都是)  │
       └───────────────────────────────────────────────┘
       ┌─ viewerHasSubmitted = true ───────────────────┐
       │  summary: decrypt(ai_summary_enc) ≤140字      │
       │  ai_summary_enc 本身不出现在响应 JSON          │
       └───────────────────────────────────────────────┘
               │
               ▼
    ④ 响应中只有 layer2_label（花名），
       user_id / member_id 绝不出现
```

**静默入账：** `POST /api/fellowship/silent` 插入 `is_silent=TRUE` 的行，不调用 AI，但同样触发 `viewerHasSubmitted = true`，允许查看团契页。

**反应（Nian/Amen）：** 通过 `increment_reaction` RPC 原子更新计数器，不记录是谁点的。

**关键文件：**
- `app/api/fellowship/posts/route.ts` — 数据分层安全模型（含详细注释）
- `app/api/fellowship/silent/route.ts` — 静默入账
- `app/api/fellowship/react/route.ts` — 匿名反应

---

### 3.3 牧养穿透（Pastoral System）

三级授权状态机，核心约束是**人名红线**：组长在成员主动授权前无法得知求助者身份。

```
成员端                              服务端
──────                              ──────
录音时勾选"需要代祷" ──────────────▶ flag_urgent RPC (SECURITY DEFINER)
                                      在 urgent_flags 表插入匿名记录
                                      (只有 alignment_id, fellowship_id)
                                      ↑ 成员的 user_id 存储但不暴露

组长后台看到"1个匿名信号" ─────────▶ GET /api/pastoral/list
                                      返回 AnonymousFlag[]
                                      { flag_id, flagged_at }
                                      ← user_id 绝不出现

组长点击"发起关怀" ────────────────▶ POST /api/pastoral/request
                                      服务端查 urgent_flags.user_id
                                      写入 pastoral_requests.member_id
                                      返回 { success: true }
                                      ← 组长此时仍不知道是谁

成员端看到代祷通知 ────────────────▶ 选择 APPROVE / DENY

成员点击"同意" ─────────────────────▶ POST /api/pastoral/approve
                                       .eq('member_id', user.id) 双重守护
                                       status → 'APPROVED'

组长后台刷新 ───────────────────────▶ GET /api/pastoral/list
                                       status=APPROVED → 查询 display_name
                                       status=PENDING/DENIED → member_name: null
                                       member_id 永不出现在响应 JSON
```

**状态流转：** `urgent_flags（匿名）→ pastoral_requests(PENDING) → APPROVED / DENIED`

**关键文件：**
- `app/api/pastoral/list/route.ts` — 人名红线的唯一解析点（含三段式注释）
- `app/api/pastoral/request/route.ts` — 组长发起关怀
- `app/api/pastoral/approve/route.ts` — 成员授权/拒绝

---

## 4. 隐私安全红线

系统设计了三条不可逾越的物理安全红线，每条均有代码层面的强制保证。

### 红线一：音销字留（音频字节生命周期管控）

**原则：** 原始音频字节和 STT 全文仅存活于 `POST /api/stt` 的函数作用域。`finally` 块保证无论成功或异常，敏感变量必被清零。

**代码位置：** `app/api/stt/route.ts`

```typescript
// 声明在 try 外，使 finally 可访问
let audioBuffer: Buffer | null = null
let rawTranscript: string | null = null

try {
  audioBuffer = Buffer.from(await audioFile.arrayBuffer())   // 节点 A 前
  const audioBlob = new Blob([audioBuffer], { ... })
  const { transcript } = await transcribeAudio(audioBlob)

  audioBuffer.fill(0); audioBuffer = null                    // ■ 音销节点 A
  rawTranscript = transcript

  const aiResponse = await generateAlignmentResponse({ ... })
  rawTranscript = null                                       // ■ 音销节点 B

  // ... 加密、落库、返回响应

} finally {
  if (audioBuffer !== null) {                                // ■ 音销节点 C
    audioBuffer.fill(0); audioBuffer = null                  //   兜底清零
  }
  rawTranscript = null                                       // ■ 音销节点 D
}
```

客户端第四节点：`components/daily/daily-form.tsx` 中 `audioBlobRef.current = null`（fetch 完成后）。

**`Buffer.fill(0)` 的意义：** 在 GC 回收前主动将 Node.js Buffer 底层 ArrayBuffer 清零，防止堆转储或 GC 扫描窗口期内的字节恢复。

---

### 红线二：午夜洗净（数据自动失效）

**原则：** 每日 CST 00:00（UTC 16:00），所有当日 `daily_alignments` 的 `is_visible` 被置为 `FALSE`；7 天后 journeys 被物理删除。

**代码位置：** `supabase/migrations/003_cron.sql`

```sql
-- pg_cron 任务（UTC 16:00 = CST 00:00）
SELECT cron.schedule(
  'midnight-purge-alignments',
  '0 16 * * *',
  $$ UPDATE daily_alignments
     SET is_visible = FALSE
     WHERE date < CURRENT_DATE
       AND is_visible = TRUE $$
);

SELECT cron.schedule(
  'purge-expired-journeys',
  '5 16 * * *',
  $$ DELETE FROM journeys WHERE expires_at <= NOW() $$
);
```

RLS 同步执行：组长只能读取 `is_visible = TRUE` 的对齐记录，确保过期数据对所有角色不可见。

---

### 红线三：匿名同行（人名隔离）

**原则：** `member_id`（UUID）存储于 `pastoral_requests` 表，但任何 API 响应都不包含它。`display_name` 仅在成员主动 APPROVE 后，在 `GET /api/pastoral/list` 的服务端内存中短暂解析，立即映射为响应字段，原始 ID 不出现在输出。

**代码位置：** `app/api/pastoral/list/route.ts`（第 118–150 行）

```typescript
// Step A: 只收集 APPROVED 请求的 member_id
const approvedIds = rawRequests
  .filter(r => r.status === 'APPROVED')
  .map(r => r.member_id)

// Step B: 批量查询 display_name
const { data: approvedUsers } = await db
  .from('users').select('id, display_name').in('id', approvedIds)

const nameMap: Record<string, string> = {}
approvedUsers?.forEach(u => { nameMap[u.id] = u.display_name })

// Step C: 映射到响应 — member_id 不进入 PastoralCard
const requests: PastoralCard[] = rawRequests.map(r => ({
  request_id:  r.id,
  status:      r.status,
  member_name: r.status === 'APPROVED' ? nameMap[r.member_id] : null,
  // member_id 字段在此被有意丢弃
}))
```

TypeScript 接口 `PastoralCard` 没有 `member_id` 字段，编译层面杜绝误传。

---

### AI 摘要加密（贯穿三个模块的横切关注点）

| 位置 | 操作 |
|---|---|
| `lib/crypto.ts:encrypt()` | AES-256-GCM，密文格式：`[IV(12)][Tag(16)][Ciphertext]` |
| `app/api/stt/route.ts:105` | `'\\x' + encryptedBuf.toString('hex')` 存入 BYTEA |
| `app/api/fellowship/posts/route.ts:156` | 仅当 `viewerHasSubmitted` 时调用 `decrypt()`，且结果不含原始字节 |
| Supabase RLS | `ai_summary_enc` 列不在任何客户端可访问的视图中暴露 |

---

## 5. 环境变量配置

复制 `.env.local.example` 为 `.env.local`，按下表填入真实值。

| 变量名 | 作用 | 是否暴露给客户端 | 必填 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | ✅ 是 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key（受 RLS 约束） | ✅ 是 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key（绕过 RLS，仅服务端） | ❌ 否 | ✅ |
| `ENCRYPTION_KEY` | AES-256-GCM 主密钥，64 字符十六进制（32 字节） | ❌ 否 | ✅ |
| `GEMINI_API_KEY` | Google AI Studio API Key | ❌ 否 | ✅ |
| `GROQ_API_KEY` | Groq Cloud API Key（Whisper STT） | ❌ 否 | ✅ |
| `NEXT_PUBLIC_APP_NAME` | 应用名称，显示于页面标题 | ✅ 是 | 否 |
| `NEXT_PUBLIC_APP_URL` | 应用访问地址，用于 Magic Link 回调 | ✅ 是 | 否 |

### 生成 ENCRYPTION_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

输出为 64 字符的十六进制字符串，例如：
```
a3f8c2d1e9b047561234abcd5678ef90a3f8c2d1e9b047561234abcd5678ef90
```

> **警告：** `SUPABASE_SERVICE_ROLE_KEY` 和 `ENCRYPTION_KEY` 绝不能出现在客户端 bundle 中。所有 `NEXT_PUBLIC_` 前缀的变量都会暴露到浏览器，永远不要将敏感 key 加此前缀。

### Supabase 数据库变量

运行 `supabase gen types typescript --project-id <your-project-id>` 可生成精确的 `Database` 类型文件，替代 `types/index.ts` 中的手写存根。生成后删除 `next.config.ts` 中的 `typescript: { ignoreBuildErrors: true }`。

---

## 6. 数据库 Schema 概览

### 核心表

| 表名 | 说明 | 关键列 |
|---|---|---|
| `users` | 用户档案（扩展 `auth.users`） | `role: member/leader/super_admin`, `settings: jsonb` |
| `fellowships` | 团契房间 | `invite_code char(6)`, `leader_id`, `meeting_mode`, `yt_link` |
| `fellowship_members` | 成员关联（多对多） | `layer2_label`（花名，替代真实姓名） |
| `daily_alignments` | 每日对齐记录 | `ai_summary_enc bytea`（加密摘要）, `is_urgent`, `is_silent`, `is_visible` |
| `journeys` | 个人灵修日志 | `content_enc bytea`，`expires_at`（7 天 TTL） |
| `urgent_flags` | 代祷信号（匿名） | 无 `user_id` 暴露在组长视图 |
| `pastoral_requests` | 牧养关怀请求 | `status: PENDING/APPROVED/DENIED`, `member_id`（内部，不暴露） |
| `system_configs` | 系统配置（key-value） | `key text unique`, `value jsonb` |

### 视图

| 视图名 | 说明 |
|---|---|
| `visible_alignments` | 过滤 `is_visible=TRUE` 的对齐记录 |
| `admin_spiritual_weather` | 全网今日 status_tag 分布（count + pct） |
| `admin_cost_basis` | 按月汇总计费对齐次数 |

### 预置 system_configs 键

| Key | 说明 | 默认值结构 |
|---|---|---|
| `ai_circuit_breaker` | AI 服务熔断开关 | `{ active: true, disabled_at: null, toggled_by: null }` |
| `global_notice` | 全站公告（可选） | `{ enabled: false, message: "" }` |
| `donation_settings` | 奉献配置 | `{ enabled: true, amount_options: [30, 50, 100, 200] }` |
| `payment_links` | 支付链接 | `{ wechat: "", alipay: "" }` |
| `cost_rates` | AI 单价（用于后台估算） | `{ gemini_per_call: 0.0002, whisper_per_call: 0.0013 }` |

---

## 7. 管理员后台使用说明

管理员后台位于 `/admin/hub`，仅 `role = super_admin` 的账号可访问。

### 访问方式

1. 使用绑定了 `super_admin` 角色的邮箱登录。
2. 登录成功后，页面弹出选择框：**进入管理中枢** 或 **进入今日内室**。
3. 选择"进入管理中枢"，或直接访问 `/admin/hub`。

> 若直接访问 `/admin/hub` 但角色不是 `super_admin`，将被重定向至首页。

---

### 卡片说明

#### 运维监控（DevOps Monitor）

| 指标 | 说明 |
|---|---|
| 注册用户 | `users` 表总行数 |
| 今日对齐 | 今日 `daily_alignments` 总数 |
| 团契数 | `fellowships` 表总行数 |
| 本月费用 | `billable × (¥0.0002 + ¥0.0013 USD)`，自动折算 |
| 预测月底 | `(当前费用 / 已过天数) × 当月总天数` |

页面 ISR 缓存 60 秒（`export const revalidate = 60`）。

---

#### 财务 & 配置（Finance & Config）

展示并允许内联编辑以下 `system_configs` 键：

- **奉献设置（`donation_settings`）** — 控制奉献模块是否启用，配置金额选项。
- **支付链接（`payment_links`）** — 微信 / 支付宝收款码 URL。
- **AI 费率（`cost_rates`）** — Gemini 和 Whisper 的单次计费估算单价（仅用于后台展示，不影响实际计费）。

**编辑流程：** 点击"编辑" → 修改 JSON → 点击"保存"。格式错误时提示"JSON 格式有误"，保存失败时提示重试。点击旋转图标可撤销本次编辑。

---

#### 牧养总览（Pastoral Overview）

- **全网属灵天气** — 今日 `daily_alignments.status_tag` 分布，以百分比进度条可视化。数据来自 `admin_spiritual_weather` 视图，不含任何个人信息。
- **待回应牧养请求** — 全系统所有团契中 `status = PENDING` 的请求数量。数字大于 0 时显示红色警告徽章。

---

#### 快捷操作（Quick Actions）

##### AI 熔断器

用于在 AI 服务异常（成本激增 / API 故障）时一键阻断全网 STT 请求。

| 操作 | 效果 |
|---|---|
| 点击"立即熔断" | 按钮变为红色 + `animate-pulse`，等待二次确认 |
| 4 秒内再次点击 | 执行熔断，`ai_circuit_breaker.active → false` |
| 4 秒内未确认 | 自动取消，回到初始状态 |
| 熔断生效后 | 所有 `POST /api/stt` 返回 `503 ai_circuit_breaker` |
| 点击"恢复 AI" | 立即生效，无需二次确认 |

熔断状态由 `system_configs.ai_circuit_breaker.value.active` 决定，`/api/stt` 在管道最前端检查，不消耗任何 AI 额度。

##### 新建团契

| 字段 | 说明 |
|---|---|
| 团契名称 | 任意字符串，最长 100 字 |
| 组长邮箱 | 必须已注册；角色需为 `leader` 或 `super_admin` |

点击"创建团契并生成邀请码"后：
- 服务端通过 `auth.admin.listUsers()` 解析邮箱 → user_id。
- `fellowships` 表新增一行，`assign_invite_code()` 触发器自动生成 6 位无歧义邀请码。
- 邀请码显示在成功卡片中，点击复制图标可一键复制。

**常见错误：**

| 错误码 | 含义 | 处理方式 |
|---|---|---|
| `leader_not_found` | 邮箱未注册 | 确认用户已完成注册后重试 |
| `leader_role_required` | 用户角色为 `member` | 先在 Supabase Dashboard 将该用户 `role` 改为 `leader` |
| `db_error` | 数据库写入失败 | 检查 Supabase 连接 / RLS 策略 |

---

### 后台安全机制

- **双重守护**：`middleware.ts` 检查认证状态，`app/(dashboard)/admin/layout.tsx` 进行 DB 角色查询，两道关卡缺一不可。
- **service_role 隔离**：所有管理接口使用 `createServiceClient()`，绕过 RLS 以执行跨用户查询，但每个接口都在应用层验证 `super_admin` 角色后才执行。
- **操作日志**：熔断器操作将 `toggled_by: user.id` 写入 `system_configs`，保留操作人记录。

---

## 附录：开发常用命令

```bash
# 启动开发服务器
npm run dev

# 类型检查（含预期的 Database 类型存根错误）
npm run type-check

# 推送数据库迁移
supabase db push

# 生成精确的 TypeScript 类型（替换 types/index.ts 中的存根）
supabase gen types typescript --project-id <project-id> > types/supabase.ts

# 生成新的加密主密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
