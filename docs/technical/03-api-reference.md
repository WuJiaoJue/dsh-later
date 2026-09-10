# API 参考

---

## 1. 用户工具

### 1.1 `user_schedule_create`

**描述**：在当前会话中创建定时提醒。

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `prompt` | string | ✅ | 提醒内容（trim 后非空，≤1000 字符） |
| `after_seconds` | positive int | ❌* | 延时秒数 |
| `at` | string \| LocalAtInput | ❌* | 绝对时间 |
| `every_seconds` | positive int (≥300) | ❌* | 固定间隔秒数 |
| `time_zone` | string | ✅ | IANA 时区 |
| `smart_window` | SmartWindowInput | ❌ | 智能时段配置 |

> *`after_seconds`/`at`/`every_seconds` 有且只有一项。

**请求示例**：

```json
{
  "prompt": "检查构建结果",
  "after_seconds": 600,
  "time_zone": "Asia/Shanghai"
}
```

**响应**：

```json
{
  "ok": true,
  "id": "schedule-1",
  "kind": "after",
  "scheduled_at": "2026-08-19T06:00:00Z",
  "state": "scheduled",
  "delivery_mode": "session-local"
}
```

**错误响应**：

```json
{
  "ok": false,
  "code": "invalid_prompt",
  "message": "提醒内容不能为空"
}
```

---

### 1.2 `user_schedule_list`

**描述**：列出当前会话的所有活动提醒。

**参数**：无

**响应**：

```json
{
  "ok": true,
  "schedules": [
    {
      "id": "schedule-1",
      "kind": "after",
      "prompt": "检查构建结果",
      "after_seconds": 600,
      "scheduled_at": "2026-08-19T06:00:00Z",
      "state": "scheduled",
      "delivery_mode": "session-local",
      "source": "user-tool"
    },
    {
      "id": "schedule-2",
      "kind": "every",
      "prompt": "检查服务状态",
      "every_seconds": 300,
      "scheduled_at": "2026-08-19T06:05:00Z",
      "state": "overdue",
      "delivery_mode": "session-local",
      "source": "user-tool"
    }
  ]
}
```

---

### 1.3 `user_schedule_delete`

**描述**：删除指定的活动提醒。

**参数**：

| 字段 | 类型 | 必填 |
|---|---|---|
| `id` | string | ✅ |

**请求示例**：

```json
{
  "id": "schedule-1"
}
```

**响应**：

```json
{
  "ok": true,
  "id": "schedule-1",
  "deleted": true
}
```

**错误响应**：

```json
{
  "ok": false,
  "id": "schedule-999",
  "deleted": false,
  "code": "schedule_not_found"
}
```

---

## 2. 内部函数

### 2.1 `userScheduleCreate`

```typescript
async function userScheduleCreate(
  input: UserScheduleCreateInput,
  ctx: Context
): Promise<ScheduleCreateResult | ScheduleToolError>
```

**流程**：
1. 输入验证（`validateCreateInput`）
2. 获取 session 和事件日志
3. 分配 ID（`allocateScheduleId`）
4. 构造记录（`createScheduleRecord`）
5. 追加到 session 事件日志
6. 等待持久化 barrier

---

### 2.2 `userScheduleList`

```typescript
async function userScheduleList(
  ctx: Context
): Promise<ScheduleListView>
```

**流程**：
1. 获取当前 session
2. 读取事件日志
3. 过滤 `source: 'user-tool'`
4. fold 出活动记录
5. 返回管理视图

---

### 2.3 `userScheduleDelete`

```typescript
async function userScheduleDelete(
  input: { id: ScheduleId },
  ctx: Context
): Promise<ScheduleDeleteResult>
```

**流程**：
1. 验证 ID 格式
2. 检查 ID 是否存在且活动
3. 追加 delete 事件到日志
4. 等待持久化 barrier

---

## 3. 验证函数

### 3.1 `validateCreateInput`

```typescript
function validateCreateInput(input: unknown): 
  | { ok: true; value: ValidatedCreateInput }
  | { ok: false; code: ScheduleErrorCode; message: string }
```

**验证规则**：
- prompt 非空且 ≤1000 字符
- after_seconds/at/every_seconds 有且只有一项
- time_zone 是有效 IANA 时区
- 计算出的目标时间在未来

---

### 3.2 `validateId`

```typescript
function validateId(value: unknown): ScheduleId | ScheduleToolError
```

**规则**：
- 非空字符串
- 无前后空白
- 格式 `schedule-N`

---

## 4. 时间工具

### 4.1 `nextSmartTarget`

```typescript
function nextSmartTarget(
  now: number,
  window: SmartWindowConfig
): number
```

**说明**：计算下一个智能时段的目标时间。

---

### 4.2 `nextCustomTarget`

```typescript
function nextCustomTarget(
  now: number,
  dateStr: string | null,
  hhmm: string
): number
```

**说明**：计算自定义时间的目标时间。

---

### 4.3 `toUtcString`

```typescript
function toUtcString(localTime: string, tz: string): string
```

**说明**：将本地时间转换为 UTC RFC 3339 字符串。

---

## 5. 错误码

| 错误码 | HTTP 状态 | 触发条件 |
|---|---|---|
| `invalid_prompt` | 400 | prompt 为空或过长 |
| `invalid_selector` | 400 | selector 多选/缺选 |
| `invalid_time_zone` | 400 | 非 IANA 时区 |
| `not_future` | 400 | 目标时间不在未来 |
| `time_out_of_range` | 400 | 超出 4 位年份表示范围 |
| `frequency_too_high` | 400 | every_seconds < 300 |
| `schedule_not_found` | 404 | 删除时 ID 不存在 |
| `persistence_uncertain` | 503 | 持久化路径不可用 |
| `internal_error` | 500 | 未知内部错误 |

---

## 6. 类型定义

### 6.1 UserScheduleCreateInput

```typescript
interface UserScheduleCreateInput {
  prompt: string;
  time_zone: string;
  smart_window?: SmartWindowConfig;
  
  // 三选一
  after_seconds?: number;
  At?: AtInput;
  every_seconds?: number;
}
```

### 6.2 AtInput

```typescript
type AtInput = string | LocalAtInput;

interface LocalAtInput {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm:ss[.S|.SS|.SSS]
  time_zone: string;  // IANA
}
```

### 6.3 SmartWindowConfig

```typescript
interface SmartWindowConfig {
  work_start: string;   // "09:00"
  work_end: string;     // "18:00"
  lunch_start: string;  // "12:00"
  lunch_end: string;    // "14:00"
  evening_end: string;  // "22:00"
}
```

---

## 参考链接

- dsh-schedule 工具 schema: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/lib/types/types.d.ts)
- JSON Schema 规范: https://json-schema.org/
- OpenAPI 规范: https://spec.openapis.org/oas/v3.1.0
