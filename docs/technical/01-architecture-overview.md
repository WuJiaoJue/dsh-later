# 技术架构总览

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        DSH Host                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              @deepseek-ai/dsh-schedule                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │   │
│  │  │ schedule_   │  │ schedule_   │  │ schedule_    │ │   │
│  │  │ create      │  │ list        │  │ delete       │ │   │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │   │
│  │         │                 │                │          │   │
│  │         ▼                 ▼                ▼          │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │         Session Event Log (JSONL)                │  │   │
│  │  │   schedule/change events (source: 'model-tool')  │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│                            │ peer dependency                 │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            dsh-later (本插件)              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │   │
│  │  │ user_       │  │ user_       │  │ user_        │ │   │
│  │  │ schedule_   │  │ schedule_   │  │ schedule_    │ │   │
│  │  │ create      │  │ list        │  │ delete       │ │   │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │   │
│  │         │                 │                │          │   │
│  │         └─────────────────┼────────────────┘          │   │
│  │                           ▼                           │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │         Session Event Log (JSONL)                │  │   │
│  │  │   schedule/change events (source: 'user-tool')  │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      DSH Web Client                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Client Bundle                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │   │
│  │  │ SchedButton │  │ SchedPanel  │  │ TaskList     │ │   │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │   │
│  │         │                 │                │          │   │
│  │         └─────────────────┼────────────────┘          │   │
│  │                           ▼                           │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │              React State + Hooks                 │  │   │
│  │  │   useSchedules / useCountdown / useTimeZone     │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 包结构

```
dsh-later/
├── index.js                    # Host 侧入口（注册用户工具）
├── client.js                   # 浏览器侧入口（GUI 面板）
├── cordis.patch.yml            # Cordis bundle patch
├── package.json
│
├── lib/
│   ├── user-tools.js           # user_schedule_create/list/delete
│   ├── smart-window.js         # 智能时段计算
│   ├── time-utils.js           # 时间工具函数
│   └── validation.js           # 输入验证
│
├── client/
│   ├── components/
│   │   ├── SchedButton.tsx     # 输入框右侧按钮
│   │   ├── SchedPanel.tsx      # 配置面板
│   │   ├── TaskList.tsx        # 任务列表
│   │   ├── CountdownChip.tsx   # 倒计时芯片
│   │   └── DateTimePicker.tsx  # 日期时间选择器
│   │
│   ├── hooks/
│   │   ├── useSchedules.ts     # 任务列表状态
│   │   ├── useCountdown.ts     # 倒计时逻辑
│   │   └── useTimeZone.ts      # 时区状态
│   │
│   └── styles/
│       ├── tokens.css          # Design Tokens
│       ├── components.css      # 组件样式
│       └── themes/
│           ├── light.css       # 浅色主题
│           └── dark.css        # 深色主题
│
└── tests/
    ├── unit/
    │   ├── validation.test.js
    │   ├── smart-window.test.js
    │   └── time-utils.test.js
    └── integration/
        ├── create-flow.test.js
        ├── dispatch-flow.test.js
        └── recovery.test.js
```

---

## 3. 依赖关系

```json
{
  "name": "dsh-later",
  "version": "1.0.0",
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-schedule": "^0.1.0-rc.7",
    "@deepseek-ai/dsh-tools": "^0.1.0-rc.7",
    "@deepseek-ai/dsh-session": "^0.1.0-rc.7"
  },
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

---

## 4. 加载顺序

```
1. ctx.sessions         ← Session 管理
2. ctx.agents           ← Agent 管理
3. ctx.tools            ← 工具注册
4. ctx.sessionPersistence ← 持久化
5. dsh-schedule         ← 底层引擎（先加载）
6. dsh-later ← 本插件（后加载，依赖 dsh-schedule）
```

---

## 5. 关键实现

### 5.1 Host 侧工具注册

```javascript
// index.js
import { defineTool } from '@deepseek-ai/dsh-tools';
import { 
  userScheduleCreate, 
  userScheduleList, 
  userScheduleDelete 
} from './lib/user-tools.js';

export const name = 'dsh-later';
export const inject = ['schedule'];  // 依赖 dsh-schedule

export function apply(ctx) {
  // 注册用户工具
  ctx.tools.register(defineTool({
    name: 'user_schedule_create',
    description: 'Create a scheduled reminder in the current session',
    parameters: { /* JSON Schema */ },
    execute: (args) => userScheduleCreate(args, ctx)
  }));
  
  ctx.tools.register(defineTool({
    name: 'user_schedule_list',
    description: 'List all active scheduled reminders',
    parameters: { /* JSON Schema */ },
    execute: () => userScheduleList(ctx)
  }));
  
  ctx.tools.register(defineTool({
    name: 'user_schedule_delete',
    description: 'Delete a scheduled reminder',
    parameters: { /* JSON Schema */ },
    execute: (args) => userScheduleDelete(args, ctx)
  }));
}
```

### 5.2 用户工具实现

```javascript
// lib/user-tools.js
export async function userScheduleCreate(input, ctx) {
  // 1. 输入验证（复用 dsh-schedule 的验证函数）
  const validated = validateCreateInput(input);
  if (!validated.ok) return validated.error;

  // 2. 获取 session 和事件日志
  const session = ctx.sessions.current();
  const events = await session.getEvents();
  
  // 3. 分配 ID（复用 dsh-schedule 的 ID 分配器）
  const folded = foldScheduleEvents(events);
  const id = allocateScheduleId(folded);

  // 4. 构造记录（source 标记为 'user-tool'）
  const record = createScheduleRecord(id, validated, Date.now());

  // 5. 追加到 session 事件日志
  await session.append({
    type: 'schedule/change',
    data: {
      version: 1,
      operation: 'create',
      source: 'user-tool',  // ← 关键：标记为用户创建
      schedule: record
    }
  });

  // 6. 等待持久化 barrier
  await session.flush();

  return { id, state: 'scheduled', ...record };
}
```

### 5.3 Client 侧面板

```javascript
// client.js 核心逻辑
function SchedPanel({ ctx }) {
  const slots = ctx.get('slots');
  const [schedules, setSchedules] = useState([]);
  const [mode, setMode] = useState('smart');
  
  // 订阅 session 事件日志
  useEffect(() => {
    const unsub = ctx.sessions.subscribe((events) => {
      const userSchedules = events
        .filter(e => e.type === 'schedule/change' && e.data.source === 'user-tool')
        .reduce(foldScheduleReducer, [])
        .filter(s => s.state === 'scheduled' || s.state === 'overdue');
      setSchedules(userSchedules);
    });
    return unsub;
  }, []);
  
  // 渲染面板
  return (
    <Popover>
      <Tabs>
        <Tab label="智能时段">
          <SmartWindow onConfirm={handleCreate} />
        </Tab>
        <Tab label="自定义时间">
          <DateTimePicker onConfirm={handleCreate} />
        </Tab>
      </Tabs>
      <TaskList items={schedules} onDelete={handleDelete} />
    </Popover>
  );
}
```

---

## 6. 性能预算

| 指标 | 目标 | 测试方法 |
|---|---|---|
| 面板打开时间 | < 100ms | Chrome DevTools Performance |
| 任务创建响应 | < 200ms | 自动化测试 |
| 触发精度 | ±1 秒 | 自动化测试 |
| 内存占用（100 任务） | < 5MB | Chrome DevTools Memory |
| 首次加载增加 | < 50KB | Bundle Analyzer |

---

## 参考链接

- dsh-schedule 架构: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/README.zh.md)
- Cordis 框架: https://www.npmjs.com/package/@deepseek-ai/cordis
- DSH 插件开发指南: https://deepseek-harness.github.io/deepseek-harness/develop/basic/
