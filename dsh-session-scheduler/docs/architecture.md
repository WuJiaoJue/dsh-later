# 架构

> 面向开发者/维护者的技术文档。用户向的介绍与使用见根目录 `README.md`。

## 总体架构

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

## 数据流

```
用户在面板确认
  └─(/user-schedule:create {json})  → 宿主 handler
        ├─ schedule/change {create}      （dsh-schedule 可解码，互不干扰）
        └─ session-scheduler/user-schedule {add}（本插件自有）
  → session 事件日志（JSONL，服务端持久化）
  → 到期：dsh-schedule runMaintenance → followup() 注入用户角色消息
  → 投影 userSchedules 推送 → GUI 芯片/列表更新
```

## 调度器（`runtime.ts`）——为什么需要

dsh-schedule 的 runtime 只在三类时机重驱：agent 创建、**其自身工具**的持久化变更、agent 转 idle。经本插件命令/工具创建的用户提醒不会命中这三类，导致 timer 不武装、不到期触发（曾在上线 E2E 中实测复现）。因此本插件自带一个 per-agent 用户调度器：

- 用户 create/delete 成功后 `requestDrive()`；agent 转 idle 也自愈重驱。
- 复用 dsh-schedule 导出的领域函数（fold / `resolveEveryOccurrence` / `render*Framing`）与 `agent.followup()`，按同款「fold → 注入 → append dispatch → flush」语义派发。
- **去重**：与 dsh-schedule 共用**同一份持久化日志**，`fold → append dispatch` 在同一 JS 线程内同步完成，先到者写入后另一方 fold 即见已派发 → 不会双触发（一次性与固定间隔均成立；E2E 与集成测试已验证）。

## 目录结构

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

## 相关文档

- [关键设计决策](./design-decisions.md)
- [验证状态与验收对照](./verification.md)
