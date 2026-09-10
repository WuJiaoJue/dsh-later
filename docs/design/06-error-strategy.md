# 错误处理策略

---

## 1. 错误分类

### 1.1 输入验证错误（创建前）

| 错误码 | 触发条件 | 用户提示 | 恢复方式 |
|---|---|---|---|
| `invalid_prompt` | prompt 为空或纯空白 | "提醒内容不能为空" | 用户输入内容 |
| `invalid_selector` | 三个 selector 多选/缺选 | "请选择延时、绝对时间或固定间隔之一" | 用户重新选择 |
| `invalid_time_zone` | 非 IANA 时区 | "请选择有效的时区（如 Asia/Shanghai）" | 用户选择时区 |
| `not_future` | 计算出的目标时间不在未来 | "目标时间必须在未来" | 用户选择更晚时间 |
| `time_out_of_range` | 超出 4 位年份表示范围 | "目标时间超出支持范围" | 用户选择更近时间 |
| `frequency_too_high` | `every_seconds < 300` | "间隔不能少于 5 分钟" | 用户增大间隔 |

### 1.2 持久化错误（创建时）

| 错误码 | 触发条件 | 用户提示 | 恢复方式 |
|---|---|---|---|
| `persistence_uncertain` | 持久化路径缺失/拒绝/已分离 | "任务创建失败，请检查存储" | 重试或联系管理员 |
| `internal_error` | 未知内部错误 | "发生内部错误，请重试" | 重试 |

### 1.3 触发错误（发送时）

| 场景 | 行为 | 用户感知 |
|---|---|---|
| 网络错误 | 保留任务，下次重试 | 无（后台重试） |
| session 已终止 | 丢弃任务，日志记录 | 无（任务历史可见） |
| followup 失败 | 保留任务，下次重试 | 无（后台重试） |
| 发送被草稿变更取消 | 任务标记为 cancelled | "提醒已取消：输入框内容已变更" |

---

## 2. 防御性设计

### 2.1 输入防御

```typescript
// 1. trim + 空值检查
const trimmed = prompt.trim();
if (!trimmed) return err('invalid_prompt');

// 2. 长度限制（防止滥用）
if (trimmed.length > 1000) return err('invalid_prompt', '提醒内容不能超过 1000 字符');

// 3. 时区强制选择（不自动推断）
if (!isValidTimeZone(time_zone)) return err('invalid_time_zone');

// 4. 时间合法性（不接受过去时间）
if (target.getTime() <= Date.now()) return err('not_future');
```

### 2.2 操作防御

```typescript
// 1. 单 session 任务上限
if (currentCount >= 100) return err('quota_exceeded', '当前会话最多 100 个定时任务');

// 2. 频率限制（防止洪水）
if (lastCreateTime && Date.now() - lastCreateTime < 1000) {
  return err('rate_limited', '操作过于频繁，请稍后再试');
}
```

---

## 3. 降级策略

### 3.1 服务端不可用

```
服务端 timer 不可用
    │
    ▼
降级为浏览器端 setTimeout
    │
    ▼
任务仍可在当前标签页触发
    │
    ▼
恢复后同步到服务端
```

### 3.2 localStorage 作为备份

```
创建任务时
    │
    ├── 写入 session 事件日志（主）
    │
    └── 写入 localStorage（备份）
            │
            ▼
        恢复时优先读 session 日志
            │
            └── session 不可用时，从 localStorage 恢复
```

---

## 4. 错误恢复

### 4.1 自动恢复

| 场景 | 恢复策略 |
|---|---|
| cold session 恢复 | 自动 fold 逾期记录，15 分钟内补发 |
| 网络中断恢复 | 自动重试发送 |
| 浏览器崩溃重启 | localStorage 恢复任务 |

### 4.2 手动恢复

| 场景 | 恢复策略 |
|---|---|
| 任务被误删 | 从 session 日志重建（需工具支持） |
| 发送失败 | 提供"重试"按钮 |
| 时区选错 | 提供"编辑"功能（v2） |

---

## 参考链接

- dsh-schedule 错误码: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/README.zh.md)
- DSH Session 恢复: https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/session/
