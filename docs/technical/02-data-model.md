# 数据模型

---

## 1. 核心实体

### 1.1 ScheduleRecord（提醒记录）

完全复用 dsh-schedule 的记录格式：

```typescript
// 延时提醒
interface AfterScheduleRecord {
  readonly id: ScheduleId;          // 品牌类型，session 内唯一
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
}

// 固定间隔提醒
interface EveryScheduleRecord {
  readonly id: ScheduleId;
  readonly kind: 'every';
  readonly prompt: string;
  readonly everySeconds: number;    // ≥ 300
  readonly scheduledAt: string;     // 最早锚点对齐发生
}

// 联合类型
type ScheduleRecord = AfterScheduleRecord | AtScheduleRecord | EveryScheduleRecord;
```

### 1.2 ScheduleEvent（事件日志）

```typescript
// 基础事件结构
interface ScheduleChangeEvent {
  readonly version: 1;
  readonly operation: 'create' | 'delete' | 'dispatch';
  readonly source: 'user-tool' | 'model-tool';  // 本插件新增 source 字段
}

// 创建事件
interface ScheduleCreateChange extends ScheduleChangeEvent {
  readonly operation: 'create';
  readonly schedule: ScheduleRecord;
}

// 删除事件
interface ScheduleDeleteChange extends ScheduleChangeEvent {
  readonly operation: 'delete';
  readonly id: ScheduleId;
}

// 触发事件
interface ScheduleDispatchChange extends ScheduleChangeEvent {
  readonly operation: 'dispatch';
  readonly id: ScheduleId;
  readonly acceptedAt?: string;  // Every 类型专用
}

type ScheduleChange = ScheduleCreateChange | ScheduleDeleteChange | ScheduleDispatchChange;
```

---

## 2. 状态派生

### 2.1 活动记录（Active Schedules）

```typescript
interface FoldedSchedules {
  readonly active: readonly ScheduleRecord[];  // 按创建顺序
  readonly seenIds: readonly ScheduleId[];     // 所有曾用 ID
}

// fold 算法
function foldScheduleEvents(events: ScheduleChange[]): FoldedSchedules {
  const active: ScheduleRecord[] = [];
  const seenIds: ScheduleId[] = [];
  const deleted = new Set<ScheduleId>();

  for (const event of events) {
    if (event.source !== 'user-tool') continue;  // 只取用户创建的
    
    switch (event.operation) {
      case 'create':
        active.push(event.schedule);
        seenIds.push(event.schedule.id);
        break;
      case 'delete':
        deleted.add(event.id);
        break;
      case 'dispatch':
        // 一次性提醒从 active 移除
        const idx = active.findIndex(s => s.id === event.id);
        if (idx !== -1 && active[idx].kind !== 'every') {
          active.splice(idx, 1);
        }
        break;
    }
  }

  return {
    active: active.filter(s => !deleted.has(s.id)),
    seenIds
  };
}
```

### 2.2 管理视图（Schedule View）

```typescript
interface ScheduleView {
  readonly id: ScheduleId;
  readonly kind: 'after' | 'at' | 'every';
  readonly prompt: string;
  readonly scheduledAt: string;      // UTC RFC 3339
  readonly state: 'scheduled' | 'overdue';
  readonly deliveryMode: 'session-local';
  // 扩展字段
  readonly afterSeconds?: number;    // after 类型
  readonly everySeconds?: number;    // every 类型
  readonly source: 'user-tool';      // 来源标记
}

// 计算 state
function scheduleView(record: ScheduleRecord, now: number): ScheduleView {
  const scheduledTime = Date.parse(record.scheduledAt);
  return {
    ...record,
    state: now >= scheduledTime ? 'overdue' : 'scheduled',
    deliveryMode: 'session-local',
    source: 'user-tool'
  };
}
```

---

## 3. ID 分配

```typescript
// 永不复用的 ID 分配器
function allocateScheduleId(folded: FoldedSchedules): ScheduleId {
  let n = folded.seenIds.length + 1;
  let id: ScheduleId;
  do {
    id = ScheduleId(`schedule-${n}`);
    n++;
  } while (folded.seenIds.includes(id));
  return id;
}
```

---

## 4. 时间规范化

### 4.1 输入格式

| 类型 | 格式 | 示例 |
|---|---|---|
| `after_seconds` | 正整数 | `600`（10 分钟） |
| `at`（字符串） | RFC 3339 | `2026-08-19T14:00:00+08:00` |
| `at`（对象） | `{date, time, time_zone}` | `{date: "2026-08-19", time: "14:00", time_zone: "Asia/Shanghai"}` |
| `every_seconds` | 正整数（≥300） | `300`（5 分钟） |

### 4.2 输出格式

所有时间统一为 **UTC RFC 3339**：

```
2026-08-19T06:00:00.000Z
```

### 4.3 时区处理

```typescript
// 时区验证（IANA）
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// 本地时间 → UTC
function toUtc(date: string, time: string, tz: string): string {
  const local = new Date(`${date}T${time}:00`);
  // 使用 Intl API 处理时区转换
  const utc = new Date(local.toLocaleString('en-US', { timeZone: 'UTC' }));
  return utc.toISOString();
}
```

---

## 5. 事件溯源

### 5.1 事件日志示例

```jsonl
{"type":"schedule/change","data":{"version":1,"operation":"create","source":"user-tool","schedule":{"id":"schedule-1","kind":"after","prompt":"检查构建结果","afterSeconds":600,"scheduledAt":"2026-08-19T06:00:00Z"}}}
{"type":"schedule/change","data":{"version":1,"operation":"create","source":"user-tool","schedule":{"id":"schedule-2","kind":"every","prompt":"检查服务状态","everySeconds":300,"scheduledAt":"2026-08-19T06:05:00Z"}}}
{"type":"schedule/change","data":{"version":1,"operation":"dispatch","source":"user-tool","id":"schedule-1"}}
{"type":"schedule/change","data":{"version":1,"operation":"delete","source":"user-tool","id":"schedule-2"}}
```

### 5.2 重放恢复

```typescript
// 从事件日志恢复当前状态
async function restoreFromLog(session: Session): Promise<ScheduleView[]> {
  const events = await session.getEvents();
  const changes = events
    .filter(e => e.type === 'schedule/change')
    .map(e => e.data as ScheduleChange);
  
  const folded = foldScheduleEvents(changes);
  return folded.active.map(s => scheduleView(s, Date.now()));
}
```

---

## 6. 存储层

### 6.1 服务端存储

```
~/.dsh/sessions/{session-id}/
├── header.json         ← Session 元数据
├── events.jsonl        ← 事件日志（包含 schedule/change）
└── projection.cache    ← 投影缓存（可选）
```

### 6.2 客户端存储

```typescript
// 仅用于 UI 状态，不作为 source of truth
interface ClientState {
  panelOpen: boolean;
  mode: 'smart' | 'custom';
  selectedDate: string;
  selectedTime: string;
  timeZone: string;
}

// 使用 React state，无需持久化
// 刷新后从服务端恢复
```

---

## 7. Fork 隔离

```typescript
// fork 只折叠 seedLength 之后的事件
function foldScheduleEvents(
  events: ScheduleChange[], 
  seedLength: number = 0
): FoldedSchedules {
  return fold(events.slice(seedLength));
}

// 子会话不继承父会话的提醒
// 这是 dsh-schedule 的设计，本插件完全复用
```

---

## 参考链接

- dsh-schedule 数据模型: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/lib/types/types.d.ts)
- DSH Session 文档: https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/session/
- RFC 3339: https://datatracker.ietf.org/doc/html/rfc3339
- IANA 时区数据库: https://www.iana.org/time-zones
