# dsh-schedule 深度源码分析

> 本文件分析 `dsh-schedule` 的实现，作为 later 插件的设计参考。

---

## 1. 包结构

```
dsh-schedule/
├── lib/
│   ├── index.js              ← 核心实现（1389 行）
│   ├── invariant.js          ← 不变量校验
│   └── types/
│       ├── index.d.ts        ← 主入口类型
│       ├── domain.d.ts       ← 领域函数类型
│       ├── tools.d.ts        ← 工具注册函数类型
│       ├── types.d.ts        ← 值类型定义
│       └── runtime.d.ts      ← 运行时类型
├── src/                      ← 源码（TypeScript）
└── package.json
```

---

## 2. 核心数据模型

### 2.1 三种提醒记录

```typescript
// 延时提醒
interface AfterScheduleRecord {
  readonly id: ScheduleId;
  readonly kind: 'after';
  readonly prompt: string;          // 提醒内容（已 trim）
  readonly afterSeconds: number;    // 正整数延时
  readonly scheduledAt: string;     // RFC 3339 UTC 目标时间
}

// 绝对时间提醒
interface AtScheduleRecord {
  readonly id: ScheduleId;
  readonly kind: 'at';
  readonly prompt: string;
  readonly scheduledAt: string;     // 规范化后的 UTC 目标时间
  // 注意：不保留用户提交的偏移量或时区
}

// 固定间隔提醒
interface EveryScheduleRecord {
  readonly id: ScheduleId;
  readonly kind: 'every';
  readonly prompt: string;
  readonly everySeconds: number;    // ≥ 300
  readonly scheduledAt: string;     // 最早锚点对齐发生
}
```

### 2.2 事件日志格式

```typescript
// 创建事件
interface ScheduleCreateChange {
  readonly version: 1;
  readonly operation: 'create';
  readonly schedule: ScheduleRecord;
}

// 删除事件
interface ScheduleDeleteChange {
  readonly version: 1;
  readonly operation: 'delete';
  readonly id: ScheduleId;
}

// 一次性触发事件
interface OneShotScheduleDispatchChange {
  readonly version: 1;
  readonly operation: 'dispatch';
  readonly id: ScheduleId;
}

// 固定速率触发事件
interface EveryScheduleDispatchChange {
  readonly version: 1;
  readonly operation: 'dispatch';
  readonly id: ScheduleId;
  readonly acceptedAt: string;  // 决策时点（UTC RFC 3339）
}
```

### 2.3 领域函数（domain functions）

```typescript
// 从事件日志 fold 出活动记录
foldScheduleEvents(events, seedLength?): FoldedSchedules

// 分配永不复用的 id
allocateScheduleId(folded): ScheduleId

// 验证并创建各类记录
createAfterScheduleRecord(id, prompt, afterSeconds, now): AfterScheduleRecord
createAtScheduleRecord(id, prompt, at, now): AtScheduleRecord
createEveryScheduleRecord(id, prompt, everySeconds, now): EveryScheduleRecord

// 派生管理视图
scheduleView(record, now): ScheduleView

// 渲染模型 framing（注入防护）
renderReminderFraming(record): string        // 一次性
renderEveryReminderBatchFraming(reminders): string  // 批次

// 固定速率决策（不回放积压）
resolveEveryOccurrence(record, acceptedAt): EveryOccurrence
```

---

## 3. 设计亮点

### 3.1 事件溯源（Event Sourcing）

**当前状态 = fold(事件日志)**，不单独存储"当前状态"。

优势：
- 崩溃恢复只需重放日志
- 并发安全（append-only）
- 天然 audit trail

### 3.2 fork 隔离

```typescript
foldScheduleEvents(events, seedLength) {
  return events.slice(seedLength);
}
```

子会话只折叠 `seedLength` 之后的事件，**不继承父会话的提醒**。

### 3.3 注入防护

```typescript
reminder_prompt_json: JSON.stringify(prompt)
```

动态内容先 JSON 转义再嵌入 markdown framing，防止用户提示词破坏消息结构。

### 3.4 固定速率的"只追赶最新"

```typescript
// 逾期 Every 记录只贡献最新一个到期发生时点
resolveEveryOccurrence(record, acceptedAt) {
  // 选择该记录最新一个已到期且与创建锚点对齐的发生时点
  // 将记录直接推进到第一个未来目标
  // 不会枚举或回放错过的间隔
}
```

### 3.5 严格验证（封闭领域）

```typescript
// 错误码是封闭集合
type ScheduleErrorCode =
  | 'invalid_prompt'
  | 'invalid_selector'
  | 'invalid_rule'
  | 'invalid_time_zone'
  | 'not_future'
  | 'time_out_of_range'
  | 'frequency_too_high'
  | 'corrupt_schedule_log'
  | 'persistence_uncertain'
  | 'internal_error';
```

**拒绝**而非"尽力而为"：
- 未知版本 → 拒绝
- 额外字段 → 拒绝
- 重复 ID → 拒绝
- 形状不匹配 → 拒绝

---

## 4. 已知局限

| 局限 | 说明 | 本插件是否需要处理 |
|---|---|---|
| 仅会话本地交付 | cold session 需恢复后补发 | 否（这是设计边界） |
| 无 Cron 表达式 | 仅固定间隔 | 否（v1 不处理） |
| 最低 5 分钟间隔 | 防止过于频繁 | 否（复用） |
| 无 GUI | 只能模型调用 | **是**（本插件核心解决） |
| 时区必须显式指定 | 不自动推断 | 否（复用，GUI 帮填） |

---

## 5. 可复用的设计决策

| 决策 | 本插件是否复用 | 理由 |
|---|---|---|
| 事件溯源 | ✅ | 跨设备、关网页恢复的基础 |
| fork 隔离 | ✅ | 避免提醒跨会话泄漏 |
| 注入防护 | ✅ | 安全必需 |
| 严格验证闭包 | ✅ | LLM 场景必须 |
| "只追赶最新"策略 | ✅ | 避免提醒风暴 |
| Agent-scoped 队列串行化 | ✅ | 并发安全 |
| 显式时区 | ✅ | 确定性 |

---

## 参考链接

- npm: https://www.npmjs.com/package/@deepseek-ai/dsh-schedule
- 源码: `deepseek-harness/packages/schedule/schedule`
- README（中文）: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/README.zh.md)
- Invariant 模块: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/lib/invariant.js)
