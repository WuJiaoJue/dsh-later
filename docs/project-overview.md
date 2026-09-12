# Session Scheduler — 会话内定时消息插件

> 在 `dsh-schedule` 底层引擎之上，提供用户可直接操作的 GUI + 用户工具，实现"关网页也能准时触发的会话内定时消息"。

---

## 快速导航

```
scheduler-plugin/                        ← 仓库根（gitea: dsh-plugins/dsh-later）
├── README.md                            ← 本文档（总览 + 参考链接）
├── prd.md                               ← PRD 单文件版（保留归档）
├── docs/
│   ├── design/                          ← 设计文档
│   │   ├── 01-problem-and-goals.md      ← 问题定义与目标
│   │   ├── 02-user-research.md          ← 用户调研与场景
│   │   ├── 03-competitive-analysis.md   ← 竞品深度分析
│   │   ├── 04-information-architecture.md ← 信息架构
│   │   ├── 05-interaction-flows.md      ← 交互流程
│   │   ├── 06-error-strategy.md         ← 错误处理策略
│   │   ├── 07-notification-strategy.md  ← 提醒策略
│   │   ├── 08-accessibility.md          ← 无障碍与国际化
│   │   ├── 09-privacy-and-security.md   ← 隐私与安全
│   │   └── rpd-dsh-wakatime.md          ← （错放）wakatime 的 RPD，待归位
│   ├── technical/                       ← 技术设计
│   │   ├── 01-architecture-overview.md  ← 架构总览
│   │   ├── 02-data-model.md             ← 数据模型（事件日志 Schema）
│   │   └── 03-api-reference.md          ← API 参考
│   └── ui/                              ← UI 设计
│       ├── 01-component-specs.md        ← 组件规格
│       ├── 06-design-tokens.md          ← Design Tokens
│       ├── 08-microcopy.md              ← 微文案
│       ├── 09-session-presence.md       ← 会话在场状态
│       └── 09-session-presence-mockup.html ← 在场状态原型
├── references/                          ← 依赖源码分析
│   ├── dsh-schedule-analysis.md         ← dsh-schedule 源码分析
│   └── dsh-sleep-send-analysis.md       ← dsh-sleep-send 源码分析
└── dsh-later/               ← 插件包（安装、配置、架构与验收见其 README.md）
```

---

## 1. 问题陈述

### 1.1 现状

| 现有方案 | 类型 | 用户能直接操作 | 关网页触发 | 跨设备 |
|---|---|---|---|---|
| [`dsh-schedule`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/schedule/schedule) | 官方模型工具 | ❌ | ✅ | ✅ |
| [`dsh-sleep-send`](https://github.com/Awu12277/dsh-sleep-send) | 社区 GUI 插件 | ✅ | ❌ | ❌ |
| [Host Automations](https://deepseek-harness.github.io/deepseek-harness/) | 官方外部调度 | ✅ | ✅ | ✅ |

**没有方案同时满足：用户直接操作 + 当前会话内 + 关网页也能触发。**

### 1.2 用户痛点

> "我想在当前对话里设个提醒，关了网页回来还能看到。"

- **dsh-schedule**：模型才有权限调，用户只能"求模型帮设"
- **dsh-sleep-send**：关了标签页就死了，手机上也看不到
- **Host Automations**：创建的是新 session，不在当前对话里

### 1.3 设计机会

`dsh-schedule` 已经有优秀的底层引擎（事件溯源、fork 隔离、注入防护），缺的是**用户接口层**。

---

## 2. 目标

### 2.1 产品目标

| 目标 | 衡量标准 |
|---|---|
| 用户可直接在当前会话设提醒 | 无需模型参与 |
| 关网页/换浏览器也能触发 | 服务端 timer 驱动 |
| 与 dsh-schedule 完全兼容 | 共用事件日志，互不干扰 |

### 2.2 非目标（明确不做）

| 不做 | 原因 |
|---|---|
| 外部推送（邮件/短信） | 超出 session-local 范围，由 Host Automations 覆盖 |
| Cron 表达式 | 复杂度太高，v1 聚焦固定间隔 |
| 多 session 聚合 | v1 仅当前会话，v2 考虑 |

---

## 3. 核心用户场景

### 场景 1：长任务监控

```
用户：帮我跑这个构建，10 分钟后提醒我检查
模型：（执行构建命令）
用户：（点击 ⏰，确认 10 分钟后发送"检查构建结果"）
...
10 分钟后，对话中出现：
[SCHEDULE REMINDER] 检查构建结果
```

### 场景 2：离线等待

```
用户：我先去开会，30 分钟后提醒我回来
（用户关网页，去开会）
...
30 分钟后，用户回来打开网页，看到：
[SCHEDULE REMINDER] 该回来继续工作了
```

### 场景 3：跨设备

```
用户在电脑前：设了 1 小时后提醒
用户关电脑出门
...
1 小时后，用户手机打开 DSH 网页，看到提醒
```

---

## 4. 核心功能

### 4.1 用户工具

| 工具 | 说明 |
|---|---|
| `user_schedule_create` | 创建定时提醒 |
| `user_schedule_list` | 列出当前会话的提醒 |
| `user_schedule_delete` | 删除指定提醒 |

### 4.2 GUI 面板

```
输入框右侧 ⏰ 按钮 → 打开面板
├── 智能时段（默认）
├── 自定义时间
├── 任务列表（可删除）
└── 实时倒计时芯片
```

### 4.3 触发机制

- **发送方式**：注入用户角色消息（不操控输入框）
- **存储位置**：Session 事件日志（与 dsh-schedule 共用）
- **持久化**：服务端 JSONL 文件
- **恢复策略**：cold session 恢复后自动补发逾期任务

---

## 5. 与 dsh-schedule 的关系

```
dsh-schedule（已有）
    │
    ├── 底层引擎：事件溯源、fold、dispatch、followup
    ├── 模型工具：schedule_create / schedule_list / schedule_delete
    └── Session 事件日志：schedule/change 联合事件
                        │
                        ↑ 完全复用
                        │
later（新增）
    │
    ├── 用户工具：user_schedule_create / user_schedule_list / user_schedule_delete
    ├── GUI 面板：输入框右侧 ⏰ 按钮
    └── 存储：source: 'user-tool' 标记，共用同一事件日志
```

**本插件是 dsh-schedule 的"用户接口扩展"，不是替代品。**

---

## 6. 竞品深度分析

### 6.1 dsh-schedule（官方）

| 维度 | 评价 |
|---|---|
| 底层设计 | ⭐⭐⭐⭐⭐ 事件溯源 + fork 隔离 + 注入防护 |
| 用户易用性 | ⭐⭐ 只能模型调 |
| 文档质量 | ⭐⭐⭐⭐ 详尽的 README 和 invariant |

> 详细分析：[references/dsh-schedule-analysis.md](references/dsh-schedule-analysis.md)

### 6.2 dsh-sleep-send（社区）

| 维度 | 评价 |
|---|---|
| 底层设计 | ⭐⭐ localStorage + 1秒轮询 |
| 用户易用性 | ⭐⭐⭐⭐ GUI 面板直观 |
| 文档质量 | ⭐⭐⭐ 基础 README |

> 详细分析：[references/dsh-sleep-send-analysis.md](references/dsh-sleep-send-analysis.md)

---

## 7. 参考链接

### 7.1 DSH 官方

| 资源 | 链接 |
|---|---|
| 官方文档站 | https://deepseek-harness.github.io/deepseek-harness/ |
| GitHub 仓库 | https://github.com/deepseek-ai/deepseek-harness |
| 插件开发指南 | https://deepseek-harness.github.io/deepseek-harness/develop/basic/ |
| 工具目录 | https://deepseek-harness.github.io/deepseek-harness/reference/tool-catalog |
| 子系统文档 | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/ |

### 7.2 dsh-schedule

| 资源 | 链接 |
|---|---|
| npm 包 | https://www.npmjs.com/package/@deepseek-ai/dsh-schedule |
| 源码目录 | `deepseek-harness/packages/schedule/schedule` |
| README（中文） | [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/README.zh.md) |
| Invariant 模块 | [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/lib/invariant.js) |

### 7.3 dsh-sleep-send

| 资源 | 链接 |
|---|---|
| GitHub 仓库 | https://github.com/Awu12277/dsh-sleep-send |
| npm 包 | https://www.npmjs.com/package/dsh-sleep-send |
| 插件详情页 | https://awesome-dsh-plugin.com/p/Awu12277/dsh-sleep-send/ |

### 7.4 Cordis 框架

| 资源 | 链接 |
|---|---|
| npm 包 | https://www.npmjs.com/package/@deepseek-ai/cordis |
| Loader 文档 | https://www.npmjs.com/package/@deepseek-ai/cordis-plugin-loader |
| Timer 文档 | https://www.npmjs.com/package/@deepseek-ai/cordis-plugin-timer |

### 7.5 社区插件生态

| 资源 | 链接 |
|---|---|
| 插件市场（在线） | https://awesome-dsh-plugin.com/ |
| 插件市场（本地） | `dshmarket` → `~/.dsh/profiles/web/node_modules/dshmarket/` |
| 本地 registry 快照 | [本地文件](/home/wujue/.dsh/profiles/web/node_modules/dshmarket/data/registry-snapshot.json) |

### 7.6 相关社区插件

| 插件 | 说明 | 链接 |
|---|---|---|
| `dsh-scheduler` | Cron/一次性定时任务 | https://github.com/yangyongzhen/dsh-scheduler |
| `dsh-aura-scheduler` | 主动调度（价值网络） | https://github.com/ljsysfurryACE/dsh-aura-scheduler |
| `dsh-plugin-scheduled-tasks` | 按项目调度 | https://github.com/Ceelog/dsh-plugins |

---

## 8. 版本规划

### v1.0.0（MVP）

- [x] `user_schedule_create/list/delete` 工具（`dsh-later/`）
- [x] GUI 面板（智能时段 + 自定义时间）
- [x] 工具行芯片（倒计时 + 任务数）
- [x] 关网页恢复（事件日志 + 投影冷恢复）
- [ ] 防覆盖逻辑（草稿变更自动取消）→ 有意取舍：`followup` 注入固化内容，不静默取消

> v1.0.0 实现状态与取舍见 [`dsh-later/README.md`](dsh-later/README.md)。

### v1.1.0（增强）

- [x] 可配置智能时段（设置页 5 个 HH:mm 字段 + maxSchedules，live 生效）
- [ ] 任务模板
- [ ] 任务历史（已发送记录）
- [ ] 键盘快捷键

### v2.0.0（高级）

- [ ] 跨 session 聚合视图
- [ ] 任务依赖关系
- [ ] 与 Host Automations 桥接
- [ ] 外部 webhook 触发

---

## 9. 验收标准

| 编号 | 场景 | 预期 |
|---|---|---|
| AC-01 | 用户输入内容，点击 ⏰ | 面板打开 |
| AC-02 | 选择智能时段，确认 | 任务创建，芯片显示倒计时 |
| AC-03 | 选择过去时间，确认 | 显示错误，不创建任务 |
| AC-04 | 任务到期 | 用户角色消息出现在对话中 |
| AC-05 | 关网页后重开 | 未到期任务继续倒计时 |
| AC-06 | 发送前修改输入框 | 任务自动取消 |
| AC-07 | fork 子会话 | 不继承父会话提醒 |
| AC-08 | 100 任务并发创建 | 全部成功，< 500ms |

---

## 10. 风险

| 风险 | 缓解 |
|---|---|
| dsh-schedule 协议变更 | 锁定 peer dependency 版本范围 |
| 用户滥用（大量任务） | 单 session 100 任务上限 |
| CSS 与主题冲突 | 命名空间隔离（`ss-` 前缀） |
| 时区错误 | 强制用户选择时区，不自动推断 |

---

## 附录：文档版本

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1 | 2026-08-20 | 初版，多文档结构 |
