# 竞品深度分析

> 本文件分析 DSH 生态中所有与"定时任务"相关的插件，作为 later 的设计参考。

---

## 1. 竞品全景

| 插件 | 类型 | 存储 | 触发方式 | GUI | 用户直接操作 |
|---|---|---|---|---|---|
| **dsh-schedule** | 官方模型工具 | Session 事件日志 | 服务端 runMaintenance | ❌ | ❌（仅模型） |
| **dsh-sleep-send** | 社区 GUI 插件 | localStorage | 浏览器端 1秒轮询 | ✅ | ✅ |
| **dsh-scheduler** | 社区插件 | 服务端 | 服务端 cron | ❌ | ❌（外部 webhook） |
| **dsh-aura-scheduler** | 社区插件 | 服务端 | 自适应心跳 | ❌ | ❌ |
| **dsh-plugin-scheduled-tasks** | 社区插件 | 服务端 | 服务端 cron | ❌ | ✅（API 层） |
| **Host Automations** | 官方外部调度 | 独立 JSON 文件 | 服务端 | ✅（Web UI） | ✅ |

---

## 2. 逐个分析

### 2.1 dsh-schedule

```
定位：官方模型工具
存储：Session 事件日志（JSONL）
触发：服务端 runMaintenance() → followup()
用户操作：❌ 只能模型调用
关网页：✅ 能触发
跨设备：✅ 跟着 session 走
```

**评价**：底层引擎优秀，但用户接口缺失。

详细分析：[dsh-schedule-analysis.md](dsh-schedule-analysis.md)

---

### 2.2 dsh-sleep-send

```
定位：社区 GUI 插件
存储：localStorage
触发：浏览器端 1秒轮询 → 操控输入框发送
用户操作：✅ GUI 面板
关网页：❌ 标签页关了就死
跨设备：❌ 换浏览器就丢
```

**评价**：GUI 体验好，但底层不可靠。

详细分析：[dsh-sleep-send-analysis.md](dsh-sleep-send-analysis.md)

---

### 2.3 dsh-scheduler

```
定位：社区 cron 任务
存储：服务端
触发：服务端 cron → shell 命令 / webhook
用户操作：❌ 仅 API 层
推送：✅ ServerChan / 钉钉 / 飞书 / Webhook
```

**源码**：https://github.com/yangyongzhen/dsh-scheduler

**评价**：能力最强，但偏离"当前会话内"的场景。更像系统 cron。

---

### 2.4 dsh-aura-scheduler

```
定位：主动调度（Agent 何时主动开口）
触发：自适应心跳 + 价值网络（紧迫度、相关性、打断代价）
```

**源码**：https://github.com/ljsysfurryACE/dsh-aura-scheduler

**评价**：设计理念新颖，但解决的是不同问题（Agent 主动 vs 用户设定）。

---

### 2.5 dsh-plugin-scheduled-tasks

```
定位：按项目调度提示词
触发：单次/间隔/cron → 新 headless session
```

**源码**：https://github.com/Ceelog/dsh-plugins

**评价**：类似 Host Automations，但按项目组织。不在当前会话内。

---

### 2.6 Host Automations

```
定位：官方外部调度
存储：~/.dsh/storages/dsh_automation.json
触发：服务端 → 创建新 session 执行 prompt
用户操作：✅ Web UI + automation_* 工具
```

**评价**：能力最强，但创建的是新 session，不在当前对话里。

---

## 3. 市场空白

```
                    用户能直接操作
                         ▲
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          │   ❌ 空白    │  本插件目标  │
          │              │              │
          │              │              │
关网页 ◄──┼──────────────┼──────────────┼──► 关网页
能触发   │              │              │    不能触发
          │  dsh-schedule│              │dsh-sleep-send
          │  dsh-scheduler│             │
          │  Host Automations          │
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
                    用户不能直接操作
```

**空白**：右上角象限 — 用户能直接操作 + 关网页也能触发。

---

## 4. 本插件的差异化定位

| 维度 | dsh-schedule | dsh-sleep-send | **later** |
|---|---|---|---|
| **存储位置** | Session 日志 | localStorage | Session 日志 |
| **触发引擎** | 服务端 runMaintenance | 浏览器端轮询 | 服务端 runMaintenance |
| **用户接口** | ❌ | ✅ GUI | ✅ GUI |
| **模型接口** | ✅ | ❌ | ✅（可选） |
| **跨设备** | ✅ | ❌ | ✅ |
| **关网页触发** | ✅ | ❌ | ✅ |
| **fork 隔离** | ✅ | ❌ | ✅ |
| **事件溯源** | ✅ | ❌ | ✅ |
| **注入防护** | ✅ | ❌ | ✅ |
| **智能时段** | ❌ | ✅ 硬编码 | ✅ 可配置 |
| **多任务排队** | ✅ | ✅ | ✅ |

---

## 5. 社区插件清单

以下是从 awesome-dsh-plugin.com 检索到的所有相关插件：

| 插件名 | 分类 | Stars | 说明 |
|---|---|---|---|
| `dsh-scheduler` | workflow | - | cron/一次性定时任务，webhook 推送 |
| `dsh-aura-scheduler` | workflow | - | 主动调度：自适应心跳 + 价值网络 |
| `dsh-plugin-scheduled-tasks` | workflow | - | 按项目调度提示词 |
| `dsh-sleep-send` | ui | 2 | GUI 定时发送（localStorage） |

---

## 参考链接

- awesome-dsh-plugin.com: https://awesome-dsh-plugin.com/
- dsh-scheduler: https://github.com/yangyongzhen/dsh-scheduler
- dsh-aura-scheduler: https://github.com/ljsysfurryACE/dsh-aura-scheduler
- dsh-plugin-scheduled-tasks: https://github.com/Ceelog/dsh-plugins
- dsh-sleep-send: https://github.com/Awu12277/dsh-sleep-send
- dsh-schedule: https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/schedule/schedule
