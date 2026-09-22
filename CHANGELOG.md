# 更新日志

本文件记录面向使用者的重要变更。细粒度提交历史见 git log。

## 未发布

- **fix** 进度条「速度不均衡 / 每秒一跳」：相位参数被逐秒重算导致双倍计数。
  - 根因：CSS 动画挂上后会**自行推进**；而 `useNow(1000)` 每秒触发重渲染，
    每次都把 `delay = -(now - start)` 重算一遍，浏览器便把播放头又前移 1 秒
    —— 这一秒动画本已走过，于是**每秒多跳一次**。
  - 实测证据：`--ss-bar-delay` 每约 1s 精确变化 **-1000ms**；宽度增量出现
    `0.0153 → 0.3485`（约 23 倍）的周期尖刺，周期与 tick 一致。
  - 修复：把「挂载时刻」用 ref 冻结（`phaseAtRef`），delay 只由它计算。这样
    重渲染（含每秒 tick）不改变参数；重新挂载（切会话回来）时 ref 重取当前时刻，
    相位仍按绝对时间对齐。
  - 修复后实测：`--ss-bar-delay` 恒定（`delayStable: true`），增量极差
    0.3336 → **0.0061**（缩小 55 倍），周期尖刺消失。
  - 暂停 → 恢复仍正确重新锚定（10.33% → 10.72% 从冻结处继续，不归零）。
- **feat** 暂停态改为「原条 + 静止」（P1 定稿）：**移除**原有的灰色斜纹填充。
  - P1 原文（docs/ui/16）：暂停 = 原条 + 静止，**不加任何纹理、不变色**。
    状态由「动 / 静」对比表达：进行中进度条在推进，暂停时停住。
  - 实现：暂停态只有 `animation: none`；进行中仅有推进动画
    （`ss-dock-bar-progress`）。**不额外叠加流动/斜纹/冰封**——真机实测两条
    的背景与底色完全一致（`background-image: none`、同为 `rgb(249,250,251)`），
    只差动画在不在跑。
  - 修正记录：先前实现误把「进行中加流光斜纹」当作 P1 的一部分（源于
    设计探索阶段 G1 方案），但那不在 P1 定义内，已移除。教训：把**独立**的
    设计决定捆进一个已拍板的方案里，会让"已确认"的范围被悄悄放大。
  - 推进动画的参数仍由 JS 注入 `--ss-bar-duration / --ss-bar-delay`
    （duration 固定为完整窗口、delay 为负的已过去量），CSS 负责声明动画，
    JS 不写 `animationName` 简写以免覆盖。
- **feat** 暂停项支持「编辑文案」与「插话发送」（此前两者都被禁用，属实现缺口）。
  - **编辑**：暂停项不在日志里（pause 时已 delete），旧实现必然 `schedule_not_found`，
    客户端只好禁用按钮。现改为直接改写 sidecar 的 `PausedEntry.prompt`——不动时刻、
    不动剩余秒数、不动 uid、不写会话事件，因此冻结进度与恢复后的窗口都不受影响。
  - **插话发送**：语义是「不等倒计时立即推送」，对暂停项恰恰最需要。现从 sidecar 留档
    取材构造消息（`user` 代发 / `context` 注入两形态与常规路径一致），投递成功后清掉留档
    （提醒已送达、应出列）。
  - 客户端：两处按钮解除 `disabled`；因宿主**不写会话事件**、投影不会立刻刷新，
    补了本地文案覆盖（`promptOverrides`）与本地摘除复用（`dismissedPaused`），
    待投影对账后自然失效。
- **fix** 暂停 / 恢复后进度条长度会变（**两处根因**）：
  - **窗口缩水（宿主）**：resume 用 `after_seconds = remaining` 重建日志记录，原窗口
    另存 `ownership.windowSeconds`；而 pause 却从日志的 `afterSeconds` 取窗口，
    于是每「恢复→再暂停」一轮窗口就缩水一次（2 分钟任务 → 暂停(120) → 恢复(85)
    → 再暂停(窗被记成 85)…）。进度条比例随之失真，实测塌缩到 2.3%。
    修复：pause 优先取 `ownership.windowSeconds`，仅首次暂停回退日志值。
  - **冻结帧基准（客户端）**：冻结比过去用 `scheduled_at` 反推，而暂停后该字段会
    换成 `originalScheduledAt`，窗口基准整体跳变。改为纯算术
    `(窗口 − 剩余) / 窗口`，并抽出 `src/bar-geometry.ts` 供两侧共用 + 单测覆盖。
  - **教训**：中途曾用「客户端墙钟」做冻结上界，导致上界随时间前进、条越缩越短
    （29% → 2.9%）；现上界仅在宿主 `paused_at` 晚于点击时补回往返耗时，
    且不影响主算式。`tests/bar-geometry.test.mjs` 锁死这两类回归。
- **fix** 删除暂停项后 dock 行不消失（**根因修复**）：投影 view 改为**以 sidecar 为准**重读 `paused`，不再信任可能陈旧的 `state.paused` 镜像。
  - 根因：删除暂停项只清 sidecar、不写会话事件——**也不能写**：该 id 在 pause 时已被
    `dsh-schedule` 删除，补写 `delete` 会抛 `schedule delete targets inactive id`，让整份
    日志读失败。
  - 而投影 cell 只在事件到达时由 `apply` 推进，且会持久化进 projection cache；客户端又按
    seq「更高者胜」消费控制帧 → 没有新事件就没有修正帧。宿主那份 `paused[]` 快照因此永久
    陈旧，**刷新页面也会被缓存恢复**（此前表现为「删不掉、且刷新后复活」）。
  - 修复：`viewUserScheduleProjection` 在 `sessionId` 可用时从 sidecar（留档的权威存储）
    重读，`readFresh` 按 mtime/size 失效，删除即刻可见。旧快照不再可能让已删行复活。
  - 客户端摘除相应收敛为「粘性直到投影变化」：仅当同 uid 以 active 复现（resume）才解除，
    不再按时间过期——过期只会让陈旧投影里的已删行复活。
- **fix** resume 先清 sidecar `paused` 再 append `create`，消除「已暂停 + 新活动」双行。
- **fix** delete 支持 wire `uid`：活动任务先映射 scheduleId；暂停项直接清 sidecar（此前 `deleted:false`）。
- **feat** 移除右下角 ⏰ 到达 toast；到点以对话消息为准。
- **feat** 暂停 / 恢复（仅 `after` + 类提醒）：dock 原地斜纹冻结，不拆分区。
  - `/user-schedule-pause` / `/user-schedule-resume`；sidecar v2 存 `uid` + `paused` 草稿。
  - 暂停 = 日志 `delete` + sidecar 留档；恢复 = `after_seconds=remaining` 重建（日志 id 会变，uid 不变）。
  - 投影 `stateVersion: 4`，wire 带 `status` / `remaining_seconds`；非 after / 已到点不显示暂停。
  - 进度条定稿 hatch（斜纹停放）。
- **chore** 上游跨代兼容收敛到 `src/upstream-compat.ts`：Session API 双轨探测
  （`ownEvents` / `events` + `seedLength`）与 peer 代次矩阵（`KERNEL_GENERATIONS`）
  单点维护。新 rc 落地：改矩阵 → `node scripts/sync-peer-matrix.mjs` → `npm test`。
  - **fix** 0.1.1 路径补上 `header.seedLength` 回退（此前恒传 `inheritedEventCount=0`，
    fork 子会话可能把继承前缀误算进用户任务）。
  - 护栏：`tests/upstream-compat.test.mjs` 锁两代形状 + package.json peer 同步。
- **fix** 悬浮卡片现在反映定时状态（修复 #4）。此前侧栏行内 badge 显示
  「有提醒」，而同一行悬浮卡片的状态区只说「空闲」，两者自相矛盾：卡片正文
  由宿主的 `sessionStatuses` 硬编码状态链生成，不认识本插件的定时任务，且
  宿主未暴露任何 hover 卡片插槽。
  - 实现方式（纯插件，零宿主改动）：在宿主已有卡片的状态区**追加**一行
    与宿主 `.hoverStatus` 同构的状态行，内容为「N 条定时提醒 + 下次触发
    时间」（到期走「等待发送」文案）。
  - 关联方式：卡片是 `body` 级 portal，与会话行无 DOM 祖先关系，改用与行内
    badge 同源的 React fiber 反查（`memoizedProps.node.id`）关联会话。
  - **纯追加**语义：不改写、不替换、不重排宿主既有状态行，`pendingInteraction`
    / `running` 等状态优先级不变；无活动定时任务的会话卡片行为完全不变。
  - 抗重渲染：卡片每次悬浮由 React 重建，依赖既有的 MutationObserver 重扫
    重插，与 badge 同一机制。
  - 探测不到宿主结构时安静跳过（绝不误标）；不依赖任何构建期 hash 类名。

## 2026-09-12

- **chore!** 插件改名 `dsh-session-scheduler` → **`dsh-later`**：消除与核心
  引擎 `dsh-schedule` 的命名撞车，贴合 `/later` 用户心智。变更范围：
  包名、cordis 条目 id（`later`）、settings 命名空间（`dsh-later`）、
  sidecar 目录（`plugin-state/later/`）、client 端 localStorage key。
  - sidecar 自动迁移：首次启动把旧目录 `plugin-state/session-scheduler/`
    的所有权文件搬到新目录（rename 优先，失败逐文件复制，幂等），
    已设定提醒不丢失。
  - 升级前已暂存在浏览器 localStorage 的离线任务不再读取（量级通常为
    0；如需找回，手动把 key `dsh-session-scheduler:pending` 改名为
    `dsh-later:pending`）。
  - 历史会话日志中的 `session-scheduler/user-schedule` 事件键与环境变量
    `DSH_SESSION_SCHEDULER_STATE_DIR` 保持读兼容（后者仍被识别，新名为
    `DSH_LATER_STATE_DIR`）。
  - 已装旧版的机器需先 `dsh plugin remove` 旧插件再 add 新版（包名已变）。

## 2026-09-10

- **fix!** 用户任务所有权移出会话日志，改存插件 sidecar 文件
  （`~/.dsh/plugin-state/session-scheduler/<sessionId>.json`），根治「宿主
  持久化静默丢行 → 历史 seq 缺口 → 整份会话拒读」事故。`/later` 的代发
  形态、GUI 面板归属、fork 隔离语义不变。
  ⚠️ 降级单向门：本版本后新建的任务无伴生事件行，回退旧版插件时这些任务
  在面板不显示（引擎触发不受影响）。整机备份请包含
  `plugin-state/session-scheduler/` 目录。
- **chore!** 仓库结构对齐项目布局：插件包移入 `dsh-session-scheduler/`
  子目录，设计工作区（PRD / 设计文档 / 源码分析）入库。
- docs: 根 README 恢复为插件版；项目总览留档 `docs/project-overview.md`
  （仓库根）。

## 2026-09-09

- docs+tooling: README 媒体刷新，新增截图采集流水线（`scripts/capture/`）。

## 2026-09-08

- feat: 会话状态图标添加动画效果。
- docs: README 全面改版为用户向介绍/展示/使用，技术内容移入 docs/。

## 2026-09 及更早（v1.0.0）

- 用户工具 `user_schedule_create/list/delete/edit` + `/later`、`/schedule`
  slash 命令；`userSchedules` 会话投影（GUI 面板 + dock + 输入框按钮）。
- 独立调度器（`runtime.ts`）：用户创建的提醒到点 dispatch + followup 注入，
  与 dsh-schedule 共用日志互不双触发。
- 智能时段排期（工作时间/午休/晚间静默）、时区处理、注入防护 framing。
