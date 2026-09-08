<div align="center">

<img src="docs/icon-presence.svg?v=1" width="64" alt="🕐"/>
<img src="docs/icon-presence.svg?v=1" width="64" alt="🕐"/>
<img src="docs/icon-presence.svg?v=1" width="64" alt="🕐"/>
<img src="docs/icon-presence.svg?v=1" width="64" alt="🕐"/>

# dsh-session-scheduler — 会话内定时消息插件

**中文** | [English](./README.en.md)

</div>

> 在 [`@deepseek-ai/dsh-schedule`](https://www.npmjs.com/package/@deepseek-ai/dsh-schedule) 底层引擎之上，提供**用户可直接操作的 GUI + 用户工具**，实现「关网页也能准时触发的**当前会话内**定时提醒」。

DSH 现有定时能力各缺一角：`dsh-schedule` 只暴露给模型、用户无法直接操作；`dsh-sleep-send` 存 localStorage、关网页即死；Host Automations 创建的是新会话。本插件补齐「用户自己设、当前对话收到、服务端驱动、跨设备」这一格。

---

## 特性

- **用户工具**（P0）：`user_schedule_create` / `user_schedule_list` / `user_schedule_delete` / `user_schedule_edit`（改内容保留原时刻），复用 dsh-schedule 领域函数，写入与其**完全兼容**的会话事件日志。
- **GUI 面板**：输入框右侧 ⏰ 按钮（order 50）→ 智能时段 / 自定义时间 / 发送预览 / 已设定任务列表 / 倒计时芯片（含取消全部）。
- **设置页配置**：DSH 设置 → 插件 → Session Scheduler 提供 输入按钮显隐开关 + `maxSchedules` + 智能时段 5 个 HH:mm 字段，全部 **live 生效**（无需重启），字段优先级 用户设置 > cordis yml > schema 默认。
- **输入框上方 dock**：待发送提醒条（单条直出 / 多条折叠可展开），每条**可单独取消、可点击 ✎ 行内改内容**。
- **`/later` 延迟发送**：到点以「你」的身份代发内容（产品取舍见心智模型）。
- **提醒到达 toast**：到期注入时右上角弹轻提示（投影差异检测，5s 自消）。
- **侧栏定时状态 badge**：有活动定时任务的会话，在侧栏行内显示紫色时钟图标（与「进行中」orb 并存；≤5 分钟转琥珀脉冲、到期转红）。数据取自 `session.list` 行级投影（全会话覆盖，含冷会话缓存），零宿主改动；行映射走 React fiber 探测，规范见 `docs/ui/09-session-presence.md`（含设计稿 mockup）。
- **关网页也能触发**：任务持久化在 session JSONL（事件溯源），到期由 dsh-schedule 引擎 dispatch + `followup()` 注入用户角色消息，不经浏览器。
- **注入防护**：提醒内容作为「非信任提醒内容」经 `renderReminderFraming` JSON 转义转达，不当作新的用户指令。`/later` 的代发形态（`delivery:'user'`）只能由人类显式输入的命令经**可信通道参数**声明——工具与 GUI 载荷里的同名字段一律无效（安全边界有回归测试锁定）。
- **积压合并派发**：关网页期间积压的多条到期一次性提醒合并为一条批次注入（framing 形状与 dsh-schedule 固定间隔批次一致），不再逐条刷屏；`/later` 与 `/schedule` 积压按投递形态分组、按时间先后分轮派发。
- **调度器自愈**：驱动异常按指数退避自动重试（1s→30s 封顶），不再永久停摆；插件热重载后正常重新挂载。
- **fork 隔离**：子会话不继承父会话提醒。
- **跟随 DSH 界面语言**：客户端微文案接入宿主 `locale` 服务（`useSchedT`，`useSyncExternalStore` 订阅），设置页切换 中文/English 时插件按钮、面板、dock、时间文案**实时跟随**（无刷新）；宿主无 locale 服务时回退中文。
- **开发体验**：`npm run watch` 监听 src/ 自动重建 + 跑形状回归测试（lib/ 硬链接自动同步到 profile）。
- **可测试**：70 个单元/集成测试覆盖纯逻辑、注册形状（回归护栏）、delivery 信任边界与端到端生命周期。

---

## 界面截图

**⏰ 定时面板** —— 快捷时段 / 自定义时间 / 已设定任务列表：

<img src="docs/screenshot-panel.png" width="340" alt="定时提醒面板"/>

**待发送 dock** —— 输入框上方倒计时条（✎ 行内改内容 / ✕ 取消；下方即输入框）：

<img src="docs/screenshot-dock.png" width="700" alt="待发送 dock 与输入框"/>

**到期真实触发** —— 到点以「⏰ 定时提醒到点」notice 形态注入对话（关网页也照常触发）：

<img src="docs/screenshot-fired.png" width="560" alt="到期注入消息"/>

**动图演示**：

| 创建定时提醒（输入 → 面板 → 加入 → dock） | 到期触发（倒计时 → 注入对话） |
|---|---|
| <img src="docs/docs-scheduler-create.gif" width="480" alt="创建定时提醒演示"/> | <img src="docs/docs-scheduler-fired.gif" width="480" alt="到期触发演示"/> |

---

## 心智模型（先看这个，避免踩「定时 vs 延迟发送」的坑）

| 动作 | 时机 | 谁“说话” | GUI 呈现 | 说明 |
|---|---|---|---|---|
| 输入框 Enter 直接发 | 立即 | 你 | 普通用户气泡 | 此刻就是你本人 |
| ⏰ 面板 / `/schedule <时间> <内容>` | 到点 | 定时提醒 | `上下文注入 · 定时提醒 · HH:MM · 内容`（可折叠 notice 行） | **提醒**：到点注入新内容，不代表你打的字 |
| `/later <时间> <内容>` | 到点 | 以你的身份 | 普通用户气泡 | **延迟发送**：到点以 `kind:'user'` 代发该内容（无注入防护 framing，产品取舍，见下） |
| `every`（≥300s 周期） | 周期 | 定时提醒 | 同 `/schedule` | 仅由工具/面板创建 |

> **为什么 `/schedule` 不是你心里那个「延迟发送」**：输入框里那行 `/schedule …` 一按回车就会**立刻**发出并作为一条用户消息落日志；被推迟的只是**新生成的提醒内容**（以 `上下文注入` 形式到达）。如果你要的是「把我现在打的这句话稍后当作我说出口」，用 **`/later`**。

> **`/later` 的有意取舍**：它让未被真人实时键入的内容以用户气泡出现，绕过核心「注入 vs 人键」的信任边界；因此只保留在人类**显式输入** `/later` 的路径（面板与工具一律走安全的 `上下文注入`）。实现上 `delivery:'user'` 只能经 `userScheduleCreate` 的 `trustedDelivery` 可信参数声明，任何通道载荷里的同名字段都被忽略。

```
┌─ 立即 ──────────┐   ┌─ 定时提醒（/schedule、⏰面板）────────┐   ┌─ 延迟发送（/later）────────┐
│ Enter 发送      │   │ 到点注入 · 上下文注入 notice 行       │   │ 到点以「我」身份代发        │
│ 普通用户气泡    │   │ 带防护 framing（non-trust）           │   │ 普通用户气泡（无 framing）  │
└─────────────────┘   └─────────────────────────────────────┘   └────────────────────────────┘
```

---

## 长文本提醒

提醒内容（`prompt`）默认最多 **1000 字符**——这是注入防护的保守下限，避免定时文本无限膨胀后被未来的 framing 解析器/注入信任边界吃掉风险。需要更长内容时，可在 DSH 设置 → 插件 → Session Scheduler 中开启：

- **关闭（默认）**：`allowLongPrompts=false`。无论 `maxPromptChars` 填什么值，都按 1000 字符校验；GUI 面板、客户端预校验、`user_schedule_create` 工具、`/schedule` / `/later` 命令、编辑命令均一致。
- **开启**：`allowLongPrompts=true` + 自定义 `maxPromptChars`（≥1 整数）。保存即时生效（无需重启会话），模型可见的 `user_schedule_create` 工具 description、错误消息里的字符数都会同步更新，避免描述与实现脱节。

### 适合开长的例子

- 一段较长的代码片段、会议纪要、长引文
- 跨设备推送到手机提醒自己的一段日记/待办清单

### 不建议开长的场景

- 提醒文本里包含可被模型视为「指令」的内容（系统提醒文本经 `renderReminderFraming` JSON 转义按 non-trust 处理，但**更长内容 = 更大的注入面**）
- 多端公共设备共享同一个 profile（任何人都能临时调大）

实际生效值与工具错误消息里的字符数完全一致：保存后模型即可看到新上限（description 动态生成）。GUI 面板在保存后立刻刷新预校验阈值，无需刷新会话。

---

## 安装

```sh
# 在本目录下（dsh-session-scheduler/）
npm install

# 构建 host + client：
npm run build
# → lib/index.js（宿主，tsc） + lib/client.js（浏览器，esbuild）

# 测试：
npm test
```

装入 DSH Web 环境（`--profile web` 之类的宿主）：

```sh
dsh plugin --profile web add "file:/path/to/dsh-session-scheduler"
# 重启 dsh web 后生效（dsh web）
```

`cordis.patch.yml` 会自动把宿主插件行插入 loader 树；`package.json#dsh.client` 声明让浏览器端进入 boot 图。

## 配置

默认开箱即用，两个相互正交的面：

**设置页（推荐，UI 可改）**：DSH 设置 → 插件 → Session Scheduler。提供 9 个字段：

- `showButton` — 是否显示输入框右侧的定时按钮（默认 `true`，下拉「显示/隐藏」）。关闭只影响 GUI 显隐：已创建的提醒仍照常触发，dock 列表也继续显示。
- `maxSchedules` — 单 session 用户任务上限（≥1 整数）。
- `allowLongPrompts` — 是否解除提示字符的默认下限（默认 `false`）。关闭时无论 `maxPromptChars` 配什么值都按 1000 字符校验——保持默认安全的注入防护姿态。
- `maxPromptChars` — 提示字符上限（≥1 整数），仅在 `allowLongPrompts=true` 时生效。默认 1000。
- `workStart` / `workEnd` / `lunchStart` / `lunchEnd` / `eveningEnd` — 智能时段 5 个 HH:mm 字段，**实时生效**（保存后「工作时间」芯片与 `nextSmartAt` 立即按新值重算，无需刷新会话）。

每个字段独立显示覆盖状态（用户层写入即「已覆盖」，可单独 reset 回 yml 起始值）。非法输入在卡片内校验并阻断保存；宿主/客户端读取前会再次清洗（`sanitizeSmartWindowConfig` 逐字段回落默认），保证下游绝不因脏输入抛错。

**cordis 启动配置**（可选，power user）：在 `~/.dsh/profiles/web/cordis.patch.yml` 按 id 覆盖 `config.maxSchedules`，作为插件初始默认值；与设置页的 user 层正交——改 yml 后**重启 dsh web** 才会以新默认值生效（不再作为 settings base 层混合）。

```yaml
- id: session-scheduler
  config:
    maxSchedules: 100   # 单 session 用户任务上限（不设则走 schema 默认 100）
```

> 设计参考：与 dsh-smooth-stream / dsh-auto-collapse 一致——yml 文件配置只决定插件**启动期**初值，运行时用户偏好走设置服务 `scope.get()` 按需读取（不主动 watch，避免一致性边界）。`applies: 'live'` 声明所有 settings 字段即时生效。

## 架构

```
DSH Host
├── dsh-schedule            ← 底层引擎：事件溯源 / dispatch / followup（peer 依赖，先加载）
│       │
│       ▼
└── dsh-session-scheduler   ← 本插件（用户接口层）
    ├── 用户工具 user_schedule_*          → 写 schedule/change（完全兼容）
    │                                        + 伴生 ownership 事件（标记用户来源）
    ├── slash 命令（client→host 变更通道）  → 复用同一套 user-tools 逻辑
    └── 会话投影 userSchedules             → GUI 实时读任务列表
            │
            ▼ (WebSocket / HTTP)
DSH Web Client
└── conversation.input.right 插槽（order 50）
    ├── SchedButton   ⏰ 打开面板
    ├── SchedPanel    智能时段 / 自定义时间 / 预览 / 任务列表
    └── CountdownChip 下次时间 (数量) [✕] 取消全部
```

数据流：

```
用户在面板确认
  └─(/user-schedule:create {json})  → 宿主 handler
        ├─ schedule/change {create}      （dsh-schedule 可解码，互不干扰）
        └─ session-scheduler/user-schedule {add}（本插件自有）
  → session 事件日志（JSONL，服务端持久化）
  → 到期：dsh-schedule runMaintenance → followup() 注入用户角色消息
  → 投影 userSchedules 推送 → GUI 芯片/列表更新
```

## 关键设计决策

### 1. `source` 字段怎么做到不破坏 dsh-schedule（与 PRD 的适配）

PRD 想在 `schedule/change` 荷载里加 `source: 'user-tool'` 区分创建来源。但 dsh-schedule 对 `schedule/change` 采用**严格解码**（`hasExactKeys` 拒绝任何多余字段）——加一个 `source` 会让 dsh-schedule 自身的 fold 抛 `corrupt_schedule_log`，破坏「两者同时安装、互不干扰」（AC-20）。

**本插件解法**：`schedule/change` 荷载**保持原样**（完全兼容），另写一条本插件自有的伴生事件 `session-scheduler/user-schedule`（`{version:1, operation:'add'|'remove', id}`）记录用户来源。dsh-schedule 的 fold 会跳过非 `schedule/change` 事件，天然互不干扰；GUI 与 `user_schedule_list` 以「schedule/change 活动记录 ∩ 伴生所有权」为据展示用户任务。

### 1b. 自有事件类型的加载兼容：激活时注册（owned-event-registration.ts）

dsh-session 的持久化读路径在加载历史时逐条校验事件类型：不在核心白名单 `KNOWN_SESSION_EVENT_TYPES` 里且未标 envelope `ignorable:true` 的事件，会让**整份日志被拒读**（`SessionFormatUnsupportedError`，GUI 表现为「历史加载失败」）——而伴生事件（见 §1）恰好是插件自有词汇。当前构建的 `Session.append(type, data)` 不暴露 `ignorable` 字段、核心文档明示插件注册面暂缓提供，因此本插件在 `apply()` 最先调用 `registerOwnedSessionEventType()` 把自有类型登记进宿主集合（进程级、幂等；该模块仅限 host 端引用，client bundle 不得引入）。

> TODO(上游)：待 dsh-session 暴露 append 侧 `ignorable` 标记后改为写入时标记（更符合 envelope 契约），并移除运行时注册。

### 2. 客户端↔宿主变更通道：slash command

在 rc.7 里客户端没有对任意插件的通用「调用宿主函数」通道（Typert Remote 需要生成器与 host service 编排，过度耦合）。本插件使用 DSH 一等公民的 **slash command**：客户端 `session.command('/user-schedule-create {json}')` 直达宿主 handler（handler 携带 `agent`，可 `agent.session.append` + `ctx.sessions.flush`），且 `command/run`/`command/done` 自动落日志（审计友好）。命令设 `recordInput: false`，避免把 GUI 载荷重复写进日志（权威载荷在 domain 事件里）。

> ⚠️ 命令名必须符合 `^[a-z][a-z0-9_-]*$`（不含冒号）——曾踩坑：`user-schedule:create` 无法通过 `parseCommand`/`COMMAND_NAME`，导致命令静默不执行（上线 E2E 实测暴露）。

读状态则用**会话投影** `userSchedules`（`useProjection`），宿主在提交事件时增量 fold、实时推送——与 `dsh-suggest-ghost` 同款机制。

### 3. fork 隔离（AC-07）

dsh-schedule 用 `seedLength` 排除派生会话继承前缀；投影框架本身按整条日志 fold。本插件投影在遇到 `session/end-seed` 事件时**重置自身状态**，因此子会话绝不继承父会话的用户提醒。

### 4. 发送方式：不操控输入框（AC-06 的取舍）

PRD/dsh-sleep-send 有「发送前草稿变更 → 自动取消」逻辑。本插件按设计采用 `followup()` 注入（提醒内容在创建时固化），草稿后文变更**不会**静默取消一个已明确排定的提醒——否则会与「关网页也要准时触发」（AC-04/AC-05，本插件核心价值）冲突。取消路径由芯片「取消全部」/ 列表「删除单个」提供。这是一个有意的产品取舍，若需要 v1.1 可加回「绑定草稿版本」的可选开关。

### 5. 用户提醒的独立调度器

dsh-schedule 的 runtime 只在其自身工具变更 / agent 转 idle 时重驱；命令创建的提醒不会被它武装 timer（线上 E2E 实测：任务显示但永不到期）。本插件因此自带 per-agent 调度器（`runtime.ts`），用户 create/delete 后重驱、到期按 dsh-schedule 语义 dispatch + followup，并借**同一份持久化日志**与 dsh-schedule 互相去重（单次触发，见集成测试与线上 E2E）。

### 6. `ProjectionDefinition` 版本陷阱（dock 不显示的根因，已修）

`@deepseek-ai/dsh-session-projection` 在 **rc.1 → rc.2** 之间把注册契约从 `{schema, view}` 改成 `{stateSchema, wire:{viewSchema, view}}`。宿主（web profile）跑 rc.2，而插件 dev 依赖一度解析到 rc.1：类型层按旧契约「通过」、运行时却按新契约把无 `wire` 的单元当 host-only 跳过 →客户端 `useProjection('userSchedules')` 永远 `undefined`，dock 静默消失。名字 `as never` 让 TS 完全没法拦截。

**教训与护栏**：
1. `domain.ts` 同时扩展 `SessionProjectionMap` 与 `SessionProjectionStateMap`；投影单元按 rc.2 形状写（`stateSchema` + `wire`）。
2. `package.json` 的 `@deepseek-ai/dsh-session-projection` 对齐 `^0.1.1-rc.2`（peer + dev）。
3. `tests/projection-unit.test.mjs` **运行时**锁定形状（旧形状会被判为 NOT client-visible），不依赖 registry 是否装得上 rc.2 类型。

## 验证状态

- **单元/集成测试**：90 个全绿（host + client 双端构建通过；`npm run typecheck` 因 dev 环境双副本 `@deepseek-ai/dsh-session` 有预存依赖类型噪音，构建不受影响——本轮改动后噪音错误较基线净减 5 条，无新增）
- **独立实例线上 E2E（Playwright 无头真点 UI）**：按钮渲染→开面板→自定义时间→确认→芯片出现→任务列表可见→**到期真触发（≈计划 75s，实测 72s）→对话出现 `user/message`（source=plugin:session-scheduler）**；磁盘日志逐条确认 create→owned→dispatch→followup 全持久化、无重复触发。
- **内核代次兼容（2026-09-07 实测）**：`0.1.1-rc.2` 与 `0.1.2-rc.1` 两代均通过 host 入口链接（运行时符号 17/17 存在）、headless 真实启动（停在 `MISSING_CREDENTIAL`，在插件加载之后）与 web 真实启动（`lib/client.js` HTTP 200）。跨代做法有三处：
  1. **peer 枚举完整覆盖**：除了 `dsh-schedule / dsh-session / dsh-session-projection`，把宿主直接 import 的 `@deepseek-ai/{cordis,dsh-agent,dsh-commands,dsh-llm,dsh-settings,dsh-tools,schemastery}` 全部列入 peer + dev——`0.1.1-rc.2` 经 `dsh-schedule` 传递提升到顶层 `node_modules/@deepseek-ai/` 时这些包是可达的；`0.1.2-rc.1` 的 hoisting 策略变化把它们留在 `.pnpm/`，**未声明 peer 的会运行时报 `ERR_MODULE_NOT_FOUND`**（已实测 `lib/runtime.js` import `@deepseek-ai/dsh-llm` 在 0.1.2 直接崩）。
  2. **设置命名空间**写作 `'dsh-session-scheduler' as SettingsNamespace`（`settingsNamespace()` helper 在 `0.1.2` 已删除，运行时导入会让整个模块链接失败）。
  3. **设置卡片所需的 `SettingsScope`** 在 `src/client/components/SchedulerSettingsCard.tsx` 内本地声明，不从 `@deepseek-ai/dsh-client-runtime/client` 取类型——该包是 `0.1.1` 内核特有，`0.1.2` 已拆走，且同名 `SettingsScope` 在 host（`dsh-settings`）与 client 两侧成员并不相同。peer 为逐代枚举 `^0.1.1-rc.2 || ^0.1.2-rc.1`（node-semver 不把预发布版算进任何范围，除非比较符带同一 `[major.minor.patch]` 元组，故无跨代区间写法）：**上游每发布新 rc 代次就要补一个枚举项**。
- **Session API 跨代（user-tools `foldUserState`）**：`0.1.1` 暴露 `session.events` + `session.header.seedLength`；`0.1.2` 改名为 `session.ownEvents()` + `session.inheritedEventCount`（`SessionLogOffset`）。代码走鸭子类型双轨探测，不引入 `any`，cache key 维度同步替换为 `inheritedEventCount`，foldScheduleEvents 第二参数透传 runtime 值。

## 目录

```
dsh-session-scheduler/
├── src/
│   ├── index.ts              # 宿主入口：用户工具 + 命令 + 投影 + 调度器装配
│   ├── domain.ts             # 事件/投影类型 + SessionEventMap/ProjectionMap/StateMap 扩展
│   ├── user-tools.ts         # user_schedule_create/list/delete/edit + foldOwnedDelivery
│   ├── projection.ts         # userSchedules 投影 fold（fork 隔离；stateSchema+wire 契约）
│   ├── runtime.ts            # 用户提醒调度器（武装 timer、到期 dispatch + followup、delivery 分流）
│   ├── commands.ts           # 客户端↔宿主变更通道（slash command：create/list/delete/edit/schedule/later）
│   ├── smart-window.ts       # 智能时段计算（纯函数，host/client 共享）
│   ├── time-utils.ts         # 时间格式化（纯函数，host/client 共享；相对/绝对时间支持 zh/en）
│   ├── owned-event-registration.ts  # 自有事件类型登记（避免历史日志拒读）
│   └── client/
│       ├── index.tsx         # 浏览器入口：input.right/dock 插槽注册 + 命令通道 + toast 宿主
│       ├── styles.ts         # ss- 命名空间 Design Tokens + 组件样式 + toast/dock 编辑样式
│       ├── strings.ts        # 双语微文案字典（zh/en 键集一致）+ format 占位符
│       ├── useSchedT.ts      # 跟随宿主 locale 的文案 hook（useSyncExternalStore）
│       ├── toast.tsx         # 提醒到达横幅（投影差异检测触发）
│       └── components/       # SchedButton / SchedPanel / ScheduleDock（含行内编辑）/ TaskList
├── tests/                    # 单元 + 集成测试（node:test，含 runtime 决策、投影形状回归、delivery 分流）
├── build.mjs                 # tsc(host) + 客户端类型检查 + esbuild(client)
├── build-client.mjs/.build-host.mjs  # 分端构建（watch 复用）
├── watch.mjs                 # 监听 src/ 自动重建 + 跑形状回归测试
├── cordis.patch.yml          # bundle patch
└── package.json
```

### 调度器（`runtime.ts`）——为什么需要

dsh-schedule 的 runtime 只在三类时机重驱：agent 创建、**其自身工具**的持久化变更、agent 转 idle。经本插件命令/工具创建的用户提醒不会命中这三类，导致 timer 不武装、不到期触发（曾在上线 E2E 中实测复现）。因此本插件自带一个 per-agent 用户调度器：

- 用户 create/delete 成功后 `requestDrive()`；agent 转 idle 也自愈重驱。
- 复用 dsh-schedule 导出的领域函数（fold / `resolveEveryOccurrence` / `render*Framing`）与 `agent.followup()`，按同款「fold → 注入 → append dispatch → flush」语义派发。
- **去重**：与 dsh-schedule 共用**同一份持久化日志**，`fold → append dispatch` 在同一 JS 线程内同步完成，先到者写入后另一方 fold 即见已派发 → 不会双触发（一次性与固定间隔均成立；E2E 与集成测试已验证）。

## 验收对照（v1.0.0）

| 编号 | 场景 | 落地 |
|---|---|---|
| AC-01 | 输入内容点击 ⏰ | ✅ 线上 E2E 实测：按钮渲染、面板可开 |
| AC-02 | 智能时段确认 | ✅ 线上 E2E 实测：自定义时间→确认→芯片显示｜任务列表 |
| AC-03 | 过去时间拒绝 | 面板校验 + 宿主 `not_future` 兜底 |
| AC-04 | 到期注入消息 | ✅ 线上 E2E 实测：到期（≈计划 75s）后对话出现 user/message（source=plugin）|
| AC-05 | 关网页重开仍在 | 事件日志持久化 + `userSchedules` 投影冷恢复 |
| AC-06 | 草稿变更 | 有意取舍：不静默取消（见上文） |
| AC-07 | fork 不继承 | `session/end-seed` 重置 |
| AC-08 | 100 并发创建 | agent 事务串行化 + 单 session 上限 100 |
| AC-20 | 与 dsh-schedule 共存 | `schedule/change` 荷载零改动（严格兼容） |

## 参考

- PRD 与设计文档：项目根目录 `prd.md`、`docs/`
- dsh-schedule 源码分析：`../references/dsh-schedule-analysis.md`
- dsh-sleep-send 源码分析：`../references/dsh-sleep-send-analysis.md`

## 许可

MIT
