# 会话定时状态显示（Session Schedule Presence）

---

## 0. 背景与目标

侧栏会话行已有「进行中」光点（`data-state="ongoing"` 的 orb 动画）。本设计为**创建了定时提醒的会话**补一个对等的状态显示，让用户不点开会话也能一眼知道「这个会话有消息待定时发送、下次什么时候发」。

实现路线在评审后二选一或并行（见 §7 实现挂点）：

| 路线 | 形态 | 挂点 | 风险 |
|---|---|---|---|
| **A 悬浮聚合胶囊** | 窗口角落「⏰ N」胶囊 + 弹出列表 | `shell.overlay`（契约内） | 低 |
| **B 行内时钟图标** | 会话行内 10×10 时钟 glyph | DOM 注入（契约外） | 中，随 DSH 升级回归 |

两案共用同一套状态机、色板与文案，视觉稿见同目录 `09-session-presence-mockup.html`。

---

## 1. 状态机

### 1.1 会话级状态矩阵

| 状态 | 条件 | 行内视觉（B） | 聚合胶囊计入（A） |
|---|---|---|---|
| `scheduled` | ≥1 条活动任务，下次触发 > 5 min | 紫色时钟，慢呼吸（2.4s） | ✅ |
| `urgent` | ≥1 条活动任务，下次触发 ≤ 5 min | 琥珀色时钟，快脉冲（0.9s） | ✅，胶囊同步转琥珀 |
| `overdue` | 任务已到期未派发（瞬时/防御态） | 红色时钟，静止 | ✅，标红行 |
| 无任务 | 0 条活动任务 | 不渲染 | 胶囊整体隐藏 |

### 1.2 与「进行中」并存

`running`（orb）与 scheduled 语义正交，**允许同时显示**：orb 在原 slot 位，时钟 badge 紧随其后（间距 4px = `--ss-space-xs`）。语义上「正在跑」与「有安排」不互斥，不合并成单一状态。

### 1.3 计数呈现

- 行内 badge **不显示数字**（10×10 尺寸塞数字不可读）。
- 任务数走 tooltip：悬停显示「下次 14:00 · 2 条任务」。
- 数字在聚合胶囊（折叠态「⏰ 3」为会话数）与 popover 列表行中呈现。

---

## 2. 视觉方案

### 2.1 ScheduledBadge（行内时钟，路线 B）

#### Glyph 设计（10×10，`shape-rendering: crispEdges`）

外圈 8 方块复用 orb 的盘面坐标，指针 2 方块指向上（12 点）与右（3 点），中心 (4,4) 留空读作表盘：

```
■ ■ ■ ■ ■        外圈: (0,0)(4,0)(8,0)(8,4)(8,8)(4,8)(0,8)(0,4)
■       ■        指针: (4,2) 上、(6,4) 右
■   □   ■        中心: (4,4) 留空
■   ■   ■
■ ■ ■ ■ ■
```

外圈 `opacity: .8`，指针 `opacity: 1`——静态时也能读出「时钟」而非「光点」。

#### 颜色

新增 token（写入 06-design-tokens.md §1.2）：

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--ss-scheduled` | `#8b5cf6` | `#a78bfa` | 定时状态专属紫（violet-500 / violet-400） |

选紫的依据：侧栏既有色彩语义为 蓝=进行中、琥珀=等待用户、绿=完成、红=错误，紫未被占用且与蓝对比清晰；青色（info）与品牌蓝过近，弃用。

#### 动效

| 状态 | 动画 | 参考 |
|---|---|---|
| `scheduled` | 外圈 opacity `.65 ↔ 1`，2.4s ease-in-out 无限呼吸 | 与 orb 的 1s chase 在节奏上强区分：orb=快/追逐，时钟=慢/稳定 |
| `urgent` | opacity `.4 ↔ 1`，0.9s 脉冲 | 对齐 CountdownChip 紧急态（橙 + 脉冲） |
| `overdue` | 无动画，红色静止 | 瞬时态，避免与 urgent 抢注意力 |
| reduced-motion | 全部禁用动画，静态着色 | 06-design-tokens §6.3 |

#### 尺寸与对齐

- glyph 10×10 px，注入后与行内 slot 同高，`vertical-align: middle`。
- 与 orb 并存间距 4px；独立存在时占原 slot 位（不额外占宽）。
- badge 外层 span 命名带插件前缀（如 `ss-presence-slot`），不依赖 DSH 类名。

#### 悬停

原生 `title` tooltip（v1 不做自绘气泡）：`下次 14:00 · 2 条任务`。

### 2.2 SchedPresencePill（悬浮聚合胶囊，路线 A）

#### 折叠态

```
      ╭─────────╮
      │ ⏰ 3    │      高 26px · 圆角 13px · padding 0 10px · 字号 12px
      ╰─────────╯      右上角 top 16 / right 16（不遮侧栏，遮挡可点击穿透区域）
```

- 内容「⏰ {n}」，n = 有活动任务的会话数（非任务数）。
- `urgent` 会话存在时，胶囊底色切换为 warning 色并将数字加粗。
- 无任何定时任务时**整体不渲染**（零噪音）。

#### 展开态（popover，280px 宽）

```
┌────────────────────────────────┐
│  ⏰ 定时提醒 · 3 个会话         │
├────────────────────────────────┤
│  🟣 插件样式测试        14:00  │   ← 25 分后 · 2 条
│  🟣 你看看这个插件…     18:00  │   ← 4 小时后 · 1 条
│  🟣 周报整理            明 09:00│  ← 明天 · 1 条
├────────────────────────────────┤
│  共 4 条任务 · 按触发时间排序    │
└────────────────────────────────┘
```

- 每行：状态点 + 会话标题（截断）+ 下次时间；次行灰字「{相对} · {n} 条」。
- 点击行 → `select(sessionId)` 打开会话并收起 popover。
- 列表按下次触发时间升序；超过 5 条内部滚动（max-height 264px）。
- `Esc` / 点击外部关闭；触发按钮 `aria-expanded`。

---

## 3. 交互

| 触发 | 行为 |
|---|---|
| 点击行内 badge | 打开所属会话（与点击行一致；badge 不拦截行点击） |
| 点击胶囊 | 展开/收起 popover |
| 点击 popover 行 | 跳转会话 + 收起 |
| 悬停行内 badge | tooltip（原生 title） |
| 提醒触发后 | 该会话任务数 −1；归零时 badge 淡出（150ms）后移除，胶囊计数同步 |

---

## 4. 无障碍

- badge `role="img"` + `aria-label="有 {n} 条定时提醒，下次 {time}"`；行 accessible name 因此包含定时信息。
- 胶囊为 `button`，`aria-expanded` 标注；popover `role="dialog"` + `aria-label="定时提醒列表"`；`Esc` 关闭并把焦点还给触发按钮。
- 全部动效在 `prefers-reduced-motion: reduce` 下退化为静态着色。
- 状态不只靠颜色区分：glyph 形状（时钟）本身即状态符号，色盲可用。

---

## 5. 微文案（新增键，对齐 08-microcopy）

| 键 | 中文 | 英文 |
|---|---|---|
| `presence.pill` | "{n} 个会话待发送" | "{n} sessions scheduled" |
| `presence.pill.title` | "定时提醒" | "Scheduled reminders" |
| `presence.popover.title` | "定时提醒 · {n} 个会话" | "Scheduled · {n} sessions" |
| `presence.row.aria` | "{title}：{n} 条定时提醒，下次 {time}" | "{title}: {n} scheduled reminder(s), next at {time}" |
| `presence.badge.aria` | "有 {n} 条定时提醒，下次 {time}" | "{n} scheduled reminder(s), next at {time}" |
| `presence.next.imminent` | "即将发送" | "Sending soon" |
| `presence.next.minutes` | "{m} 分后" | "in {m} min" |
| `presence.next.hours` | "{h} 小时后" | "in {h} h" |
| `presence.next.tomorrow` | "明天 {time}" | "Tomorrow {time}" |
| `presence.next.clock` | "{time}" | "{time}" |
| `presence.footer.count` | "共 {n} 条任务 · 按触发时间排序" | "{n} task(s) · sorted by fire time" |

相对时间规则：≤1min 用「即将发送」；<60min 取整分钟；<24h 取整小时；跨天用「明天 {time}」；更远用 `{M月d日} {time}`。

---

## 6. 状态色与既有语义对照

| 颜色 | 侧栏既有语义 | 本设计 |
|---|---|---|
| 品牌蓝（orb ongoing） | 会话进行中 | 不变，不占用 |
| 琥珀 | 等待用户操作 | `urgent` ≤5min（复用 warning，语义同源：临近期限） |
| 绿 | 完成提醒 | 不占用 |
| 红 | 错误 | `overdue`（防御态） |
| 紫 | 未占用 | `scheduled` 专属 |

---

## 7. 实现挂点

> **已实现路线 B**（DOM 注入行内 badge）。数据通道在设计评审后比 §7 早期草图
> 更简：**无需宿主任何改动**，见 §7.0。

### §7.0 数据通道（零宿主改动，实测结论）

- `session.list` 的**每一行本就携带 `projections` 块**（`dsh-host-apiproxy`
  的 `listProjectionsFor`：live 会话走 `sessionProjections.snapshot`，冷会话走
  `sessionProjectionCache.cachedSnapshot`，零日志加载），且不做 key 过滤——
  本插件的 `userSchedules`（client-visible 单元）自动覆盖**所有**会话。
- 客户端把行级块喂进 per-session 投影 store，并合入
  `SessionSummary.projectionValues`（`useSessions` 可读）。
- 因此侧栏 badge 的数据面 = 订阅 `sessions.list`（覆盖所有会话）+
  周期 `sessions.refresh()`（session.list **读** RPC，不写会话日志）补时效 +
  30s 本地 tick 重算 scheduled/urgent/overdue（零网络）。
- 早期草图里的 `/user-schedule-index` 命令**不可行**：`face.command()` 只回
  `{matched}`，不携带 handler 的 text 载荷； Typert Remote（`$mount`）虽可做
  但机制过重，投影通道已足够。
- 边界（与 dsh-schedule 语义一致）：冷会话的提醒本就不会 fire（仅会话恢复后
  处理 overdue），badge 只反映「会话有活动任务」这一事实，与实际可触发性自洽。

### §7.1 路线 B（已实现）：契约外 DOM 注入

- 行→会话映射：行元素向上 ≤8 层 React fiber，取 `memoizedProps.node.id`
  （实测深度 3，node 含 id/title/running/completed）。
- MutationObserver 监听 body 子树（childList，60ms 去抖）对账 badge；选择器
  只用 `[role="treeitem"][draggable="true"]` 结构 + fiber 探测（工作区行带
  `aria-expanded`，直接跳过），**禁止**依赖 `YDXeBa_*` 等 hash 类名。
- 插入点：行首状态 slot —— slot 内已有 svg（进行中 orb）时 badge 插在 slot
  之后（`.ss-presence-beside`，4px 间距），否则塞进 slot 内（与 orb 同位）。
- 状态机：`badgeStateFor(nextAt, now)` —— ≤0 → `overdue`（红 · 静止）；
  ≤5min → `urgent`（琥珀 · 0.9s 脉冲）；否则 `scheduled`（紫 · 2.4s 呼吸）。
  颜色：紫 `#8b5cf6`（对白/深底对比均 ≥3:1，双主题同值）；urgent/overdue 复
  用宿主 `--dsw-alias-state-warn-secondary` / `--dsw-alias-state-error-primary`。
- 风险（明说）：DSH 升级可能改变 fiber 深度/DOM 结构；React 重渲染会移除注
  入节点（observer 重插兜底）；探测失败时 badge 安静缺失，绝不误标。

### §7.2 路线 A（备选，未实施）：契约内悬浮胶囊

- `shell.overlay`（list slot，官方定位即 badge/status pill；`dsh-client-ui-commands`
  弹层为先例）+ §7.0 同一数据通道，可随时补做。

### §7.3 路线 C（长期）：上游提案

向 DSH 提案在 ui-workspace 声明行级状态插槽（如 `sidebar.workspaces.sessionRow.status`，
list kind），插件迁移为契约内注册。

---

## 8. 验收清单

- [ ] 有任务会话行内出现紫色时钟，无任务会话不出现。
- [ ] 进行中 + 有定时并存，两 glyph 同行显示且间距 4px。
- [ ] <5min 切琥珀并加速脉冲；触发完成后 badge 淡出移除。
- [ ] 悬停 tooltip 显示「下次 {time} · {n} 条任务」。
- [ ] 胶囊无任务时整体隐藏；urgent 存在时转琥珀。
- [ ] 点击胶囊行跳转到对应会话。
- [ ] 明暗两主题下状态色可辨识（对比度 ≥ 3:1 对背景）。
- [ ] `prefers-reduced-motion` 下无动画。
- [ ] 屏幕阅读器可读出「有 N 条定时提醒，下次 {time}」。

---

## 参考

- 视觉稿: `docs/ui/09-session-presence-mockup.html`
- Design Tokens: `docs/ui/06-design-tokens.md`
- 微文案: `docs/ui/08-microcopy.md`
- 组件规格（SchedButton / CountdownChip 状态表）: `docs/ui/01-component-specs.md`
