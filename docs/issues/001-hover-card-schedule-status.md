# 悬浮卡片不反映定时状态：行内 badge 说「有提醒」，悬浮卡片说「空闲」

> **状态：已修复（方案 B′）**。采用「插件自绘浮层」的改良版：不自绘浮层，
> 而是**增补宿主已有卡片的状态区**。根因调查中确认了两点关键事实，使该方案
> 可行且体验与方案 A 等价：
>
> 1. 宿主**没有任何 hover 卡片插槽**（ui-conversation / ui-sidebar /
>    ui-workspace 的 `SlotMap` 均无 hover 相关槽位），故注册式扩展不可行；
> 2. 卡片虽是 `body` 级 portal、与会话行无 DOM 祖先关系，但其 React fiber
>    在浅层（实测深度 4）携带 `memoizedProps.node.id`，**与行内 badge 用的是
>    同一套反查技术**，因此能把卡片关联回 sessionId，无需自绘浮层。
>
> 实现见 `src/client/session-presence.ts`（`findHoverCard` / `applyHoverCard`）
> 与 `src/presence.ts`（`hoverScheduleStatus` 纯文案逻辑），单测见
> `tests/hover-card.test.mjs`。语义为**纯追加**，故验收标准 3 天然满足。
>
> 未处理：关联缺口 1（宿主 `hasActiveSchedule` 读 `projectionValues.schedule`，
> 与本插件的 `userSchedules` 不同键）。属宿主内部键名不匹配，插件侧补图标会
> 与宿主图标重复，故本次不动。

## 背景

`session-presence.ts` 走的是路线 B（DOM 注入）：向侧栏会话行的状态 slot 里塞一个
`.ss-presence` 像素时钟，`data-state` 表达 scheduled / urgent / overdue 三态。

    /* src/client/session-presence.ts */
    const slot = row.firstElementChild;
    const beside = slot.querySelector('svg') !== null;
    const badge = document.createElement('span');
    badge.className = beside ? `${BADGE_CLASS} ${BADGE_CLASS}-beside` : BADGE_CLASS;
    badge.dataset.state = state;
    badge.setAttribute('title', tooltip);

行内图标因此是**注入的节点**。而鼠标悬浮该行弹出的状态卡片是宿主 React 另行渲染的浮层，
注入节点不在其中，两者数据源不一致：

| 位置 | 数据源 | 是否反映定时 |
|---|---|---|
| 行内 `.ss-presence` | 投影键 `userSchedules`（本插件） | ✅ |
| 悬浮卡片状态区 | `sessionStatuses(node, t)` 硬编码枚举 | ❌ |

## 实测

`127.0.0.1:3080`，dsh-later 已启用，同一行同一时刻：

    行内 badge      aria-label="有 1 条定时提醒，下次 56 分后"  data-state="scheduled"
    悬浮卡片正文    "现在项目的gitea上的工作流由" / "41分钟前" / "● 空闲"

badge 说有提醒，卡片说「空闲」——**同一行自相矛盾**。

## 根因

悬浮卡片正文由 `dsh-client-ui-workspace` 的 `sessionStatuses` 生成：

    /* dsh-client-ui-workspace/lib/client.js:783 */
    function sessionStatuses(node, t) {
      // subagents / pendingInteraction(approval|plan-review|question)
      // → running → runningSubagentCount → completed → 空闲
    }

这是一条**闭合的硬编码状态链**，`userSchedules` 不在其中；渲染点
`SessionHoverContent`（`lib/client.js:849`）只消费它的返回值，不读 `node.projectionValues`。
卡片侧因此没有任何状态扩展点。

## 影响

纯呈现层，**不影响定时功能**：创建、倒计时、到点送达全部照常。

影响的是「悬浮即可确认这一行有没有待触发任务」这一信息可达性。多会话并行时更明显——
行内 badge 只有一个时钟图标 + 相对时间，密集排布下不易区分，悬浮卡片本是最自然的补充入口。

## 关联缺口（同一病根）

1. **宿主原生闹钟图标永远不亮**。`hasActiveSchedule`（`lib/client.js:350`）读的是
   `projectionValues.schedule`（`dsh-schedule` 的键），本插件写的是 `userSchedules`，
   两者不是同一个键。实测该行 `hasActiveSchedule === false` 而插件 badge 正常显示。
2. 宿主自己的 `dsh-schedule` 提醒在悬浮卡片里同样不显示——宿主既有行为，非本插件引入。

## 可选方案

### 方案 A · 宿主侧扩展状态源（推荐）

在 `sessionStatuses` 中增加 schedule 状态，或把状态区改为可注册扩展点。
改动最小、无浮层冲突，且能顺带修掉关联缺口 1。

代价：**需要改宿主**（`dsh-client-ui-workspace`），超出本插件「零宿主改动」的边界。

### 方案 B · 插件自绘浮层

插件在行上挂 `mouseenter` 自行渲染浮层。无需改宿主，但会与宿主 hover card 重叠，
需处理定位、层级与互斥，体验劣于方案 A。

### 方案 C · 维持现状

若判定悬浮确认非必要，仅在 README 补一句「悬浮卡片不反映定时状态」。

## 验收标准

- [x] 有活动定时任务的行，悬浮卡片显示定时状态（条数 + 下次触发时间）
- [x] 无定时任务的行，卡片行为不变
- [x] 不影响 `pendingInteraction` / `running` 等既有状态的优先级

## 复现

1. 任意会话执行 `/schedule +1h 测试`
2. 侧栏确认该行出现 `.ss-presence` 像素时钟
3. 鼠标悬浮该行
4. 卡片状态区只有「空闲」，无定时信息

## 环境

- DSH：npx `1e7f6d9597241db0`，相关包 `dsh-client-ui-workspace`
- dsh-later：1.0.0
