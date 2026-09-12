# 信息架构

---

## 1. 整体架构

```
later/
├── Host 侧（服务端）
│   ├── user_schedule_create    ← 创建工具
│   ├── user_schedule_list      ← 列表工具
│   ├── user_schedule_delete    ← 删除工具
│   └── 复用 dsh-schedule 的事件日志和 dispatch 引擎
│
└── Client 侧（浏览器端）
    ├── SchedButton             ← 输入框右侧按钮
    ├── SchedPanel              ← 配置面板
    ├── TaskList                ← 任务列表
    └── CountdownChip           ← 倒计时芯片
```

---

## 2. 数据流

```
用户操作（GUI）
    │
    ▼
Client 侧收集输入
    │
    ▼
调用 Host 侧 user_schedule_create
    │
    ▼
Host 侧验证 + 分配 ID
    │
    ▼
追加 schedule/change 事件到 Session 日志
    │
    ▼
等待持久化 barrier
    │
    ▼
返回成功 + 新任务信息
    │
    ▼
Client 侧更新 UI（倒计时开始）
    │
    ▼
... 时间流逝 ...
    │
    ▼
dsh-schedule runMaintenance() 发现到期
    │
    ▼
followup() 注入用户角色消息
    │
    ▼
模型看到 [SCHEDULE REMINDER]
    │
    ▼
按引导转达给用户
```

---

## 3. Session 事件日志结构

```typescript
// 本插件新增的事件类型
interface UserScheduleCreateChange {
  version: 1;
  operation: 'create';
  source: 'user-tool';           // ← 区分用户创建 vs 模型创建
  schedule: ScheduleRecord;      // ← 复用 dsh-schedule 的记录格式
}

// 读取时过滤
foldScheduleEvents(events) {
  return events
    .filter(e => e.type === 'schedule/change')
    .filter(e => e.data.source === 'user-tool')  // ← 只取用户创建的
    .reduce(foldScheduleReducer, { active: [], seenIds: [] });
}
```

---

## 4. 组件层级

```
App
└── Layout
    └── Conversation
        └── Composer
            └── InputRow
                ├── AttachmentButton
                ├── VoiceButton
                ├── SchedButton          ← 本插件入口
                │   └── SchedPanel      ← 配置面板（Portal）
                │       ├── SmartWindowTab
                │       ├── CustomTimeTab
                │       ├── PreviewCard
                │       └── TaskList
                └── SendButton
```

---

## 5. 状态管理

### 5.1 Client 状态

```typescript
interface SchedState {
  schedules: ScheduleView[];      // 当前会话的活动任务
  recent: Map<string, RecentDelivery>;  // 最近发送记录
  panelOpen: boolean;             // 面板是否打开
  mode: 'smart' | 'custom';      // 当前选择的模式
  draft: string;                  // 输入框草稿
}
```

### 5.2 状态同步

```
Host 侧事件日志（source of truth）
    │
    ├── WebSocket 推送变更
    │
    ▼
Client 侧订阅更新
    │
    ▼
React 状态更新 → UI 重渲染
```

---

## 6. 依赖关系

```
later
    │
    ├── @deepseek-ai/cordis (peer)           ← 框架
    ├── @deepseek-ai/dsh-schedule (peer)     ← 底层引擎
    ├── @deepseek-ai/dsh-tools (peer)        ← 工具注册 DSL
    ├── @deepseek-ai/dsh-session (peer)      ← Session 日志
    └── react (client-only)                  ← UI 库
```

---

## 参考链接

- dsh-schedule 事件日志: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/modules/@deepseek-ai/dsh-schedule/README.zh.md)
- Cordis 框架: https://www.npmjs.com/package/@deepseek-ai/cordis
- DSH Session 文档: https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/session/
