# 关键设计决策

> 面向开发者/维护者的技术文档。记录「为什么这么做」的取舍与踩坑，改动前先读。

## 1. `source` 字段怎么做到不破坏 dsh-schedule（与 PRD 的适配）

PRD 想在 `schedule/change` 荷载里加 `source: 'user-tool'` 区分创建来源。但 dsh-schedule 对 `schedule/change` 采用**严格解码**（`hasExactKeys` 拒绝任何多余字段）——加一个 `source` 会让 dsh-schedule 自身的 fold 抛 `corrupt_schedule_log`，破坏「两者同时安装、互不干扰」（AC-20）。

**本插件解法**：`schedule/change` 荷载**保持原样**（完全兼容），另写一条本插件自有的伴生事件 `session-scheduler/user-schedule`（`{version:1, operation:'add'|'remove', id}`）记录用户来源。dsh-schedule 的 fold 会跳过非 `schedule/change` 事件，天然互不干扰；GUI 与 `user_schedule_list` 以「schedule/change 活动记录 ∩ 伴生所有权」为据展示用户任务。

## 1b. 自有事件类型的加载兼容：激活时注册（owned-event-registration.ts）

dsh-session 的持久化读路径在加载历史时逐条校验事件类型：不在核心白名单 `KNOWN_SESSION_EVENT_TYPES` 里且未标 envelope `ignorable:true` 的事件，会让**整份日志被拒读**（`SessionFormatUnsupportedError`，GUI 表现为「历史加载失败」）——而伴生事件（见 §1）恰好是插件自有词汇。当前构建的 `Session.append(type, data)` 不暴露 `ignorable` 字段、核心文档明示插件注册面暂缓提供，因此本插件在 `apply()` 最先调用 `registerOwnedSessionEventType()` 把自有类型登记进宿主集合（进程级、幂等；该模块仅限 host 端引用，client bundle 不得引入）。

> TODO(上游)：待 dsh-session 暴露 append 侧 `ignorable` 标记后，可在**确有需要**时恢复伴生事件方案并改为写入时标记。

## 1c. 所有权彻底移出会话日志：sidecar 文件（2026-09 缺口事故的根治）

**事故**：宿主持久化层在特定时序下会「seq 已消费但行未落盘」——本插件写入的伴生事件
`session-scheduler/user-schedule` 恰好命中：内存日志长度 +1，行却没写进磁盘，日志里
留下**永久 seq 缺口**。dsh-session 的读路径（含 v0→v3 格式迁移）对缺口 fail-closed，
整份历史被拒读，GUI 表现为「历史加载失败：… has seq gap (expected N, got N+1)」。
2026-09-10 已用 position-aware 重编号脚本离线修复 79 份受损日志（备份在
`~/.dsh/sessions/.seqgap-repair-backup-20260910/`），但伴生事件本身随行丢失、
不可恢复（v0→v1 迁移拒绝未知历史类型，重插即让日志再次不可读）。

**决策**：所有权 + 投递形态（`/later` 的 `delivery:'user'`）**不再写入会话日志**，
改存插件自己的 sidecar 文件：

- 路径：`<DSH_HOME>/plugin-state/later/<sessionId>.json`（2026-09-12 随插件改名自旧目录迁移）
  （解析优先级 `DSH_SESSION_SCHEDULER_STATE_DIR` > `$DSH_HOME` > `~/.dsh`；
  见 `ownership-store.ts`）。
- 原子写（tmp + rename）；损坏文件改名保留（`.corrupt-<ts>`）后按空表继续；
  进程内按 (mtime,size) 缓存，热路径零读盘。
- 写序：**sidecar 先于 `session.append`**（投影 fold 在 create 事件到达时按
  sidecar 判定归属），flush 失败则**回滚** sidecar（避免与日志漂移）；
  delete 在 **flush 成功后**才撤销（失败时保留，运行时仍可追踪该任务）。
- 投影 `init(header)` 按 sessionId 从 sidecar 装载（进程重启后恢复 GUI 归属）；
  `apply` 的 create 事件查 sidecar 缓存；日志里残留的历史伴生事件仍按原逻辑
  fold（读兼容）。投影 state 新增 `sessionId`，`stateVersion` 2 → 3。

**代价与边界**：
1. 会话删除后 sidecar 文件残留（每会话 ≤100 条、每条 ~100B，可忽略；后续可在
   会话清理钩子里顺手删除）。
2. 跨进程写同一 sidecar 采用 last-writer-wins（用户工具操作按 agent 串行，
   实际无并发写）。
3. 旧版伴生事件的注册（§1b）保留：读兼容旧日志；插件本身不再产生新伴生事件。

## 2. 客户端↔宿主变更通道：slash command

在 rc.7 里客户端没有对任意插件的通用「调用宿主函数」通道（Typert Remote 需要生成器与 host service 编排，过度耦合）。本插件使用 DSH 一等公民的 **slash command**：客户端 `session.command('/user-schedule-create {json}')` 直达宿主 handler（handler 携带 `agent`，可 `agent.session.append` + `ctx.sessions.flush`），且 `command/run`/`command/done` 自动落日志（审计友好）。命令设 `recordInput: false`，避免把 GUI 载荷重复写进日志（权威载荷在 domain 事件里）。

> ⚠️ 命令名必须符合 `^[a-z][a-z0-9_-]*$`（不含冒号）——曾踩坑：`user-schedule:create` 无法通过 `parseCommand`/`COMMAND_NAME`，导致命令静默不执行（上线 E2E 实测暴露）。

读状态则用**会话投影** `userSchedules`（`useProjection`），宿主在提交事件时增量 fold、实时推送——与 `dsh-suggest-ghost` 同款机制。

## 3. fork 隔离（AC-07）

dsh-schedule 用 `seedLength` 排除派生会话继承前缀；投影框架本身按整条日志 fold。本插件投影在遇到 `session/end-seed` 事件时**重置自身状态**，因此子会话绝不继承父会话的用户提醒。

## 4. 发送方式：不操控输入框（AC-06 的取舍）

PRD/dsh-sleep-send 有「发送前草稿变更 → 自动取消」逻辑。本插件按设计采用 `followup()` 注入（提醒内容在创建时固化），草稿后文变更**不会**静默取消一个已明确排定的提醒——否则会与「关网页也要准时触发」（AC-04/AC-05，本插件核心价值）冲突。取消路径由芯片「取消全部」/ 列表「删除单个」提供。这是一个有意的产品取舍，若需要 v1.1 可加回「绑定草稿版本」的可选开关。

## 5. 用户提醒的独立调度器

dsh-schedule 的 runtime 只在其自身工具变更 / agent 转 idle 时重驱；命令创建的提醒不会被它武装 timer（线上 E2E 实测：任务显示但永不到期）。本插件因此自带 per-agent 调度器（`runtime.ts`），用户 create/delete 后重驱、到期按 dsh-schedule 语义 dispatch + followup，并借**同一份持久化日志**与 dsh-schedule 互相去重（单次触发，见集成测试与线上 E2E）。原理详见 [`architecture.md`](./architecture.md)。

## 6. 跨代兼容单点：`upstream-compat.ts`（2026-09-17）

0.1.1 ↔ 0.1.2 的 Session API / peer 枚举差异曾散落在 `user-tools.foldUserState`、
`index.ts` settings 注册与 `package.json`。现收敛为：

| 关注点 | 位置 |
|---|---|
| Session 读日志双轨 | `readOwnEvents` / `readInheritedEventCount` |
| peer 代次矩阵 | `KERNEL_GENERATIONS` + `peerMatrixEntries()` |
| 同步 package.json | `scripts/sync-peer-matrix.mjs` |
| 矩阵护栏 | `tests/upstream-compat.test.mjs` |

新 rc checklist：矩阵追加一代 → sync 脚本 → 全量测试。settings 命名空间字面量
在 `domain.SETTINGS_NAMESPACE`（注册处仍 `as SettingsNamespace`——helper 已在 0.1.2 删除）。

## 7. `ProjectionDefinition` 版本陷阱（dock 不显示的根因，已修）

`@deepseek-ai/dsh-session-projection` 在 **rc.1 → rc.2** 之间把注册契约从 `{schema, view}` 改成 `{stateSchema, wire:{viewSchema, view}}`。宿主（web profile）跑 rc.2，而插件 dev 依赖一度解析到 rc.1：类型层按旧契约「通过」、运行时却按新契约把无 `wire` 的单元当 host-only 跳过 →客户端 `useProjection('userSchedules')` 永远 `undefined`，dock 静默消失。名字 `as never` 让 TS 完全没法拦截。

**教训与护栏**：
1. `domain.ts` 同时扩展 `SessionProjectionMap` 与 `SessionProjectionStateMap`；投影单元按 rc.2 形状写（`stateSchema` + `wire`）。
2. `package.json` 的 `@deepseek-ai/dsh-session-projection` 对齐 `^0.1.1-rc.2`（peer + dev）。
3. `tests/projection-unit.test.mjs` **运行时**锁定形状（旧形状会被判为 NOT client-visible），不依赖 registry 是否装得上 rc.2 类型。
