# 组件规格

---

## 1. SchedButton（定时按钮）

### 1.1 描述

位于输入框右侧的定时发送按钮。

### 1.2 位置

```
输入框右侧按钮行：
[📎 附件] [🎤 语音] [⏰ 定时] [➤ 发送]
                         ↑
                     order: 50
```

### 1.3 状态

| 状态 | 条件 | 视觉 |
|---|---|---|
| 默认 | 输入框有内容 | 天蓝渐变背景，⏰ 图标 |
| 禁用 | 输入框为空 | 灰色，不可点击 |
| 激活 | 面板打开 | 高亮边框 |
| 有待定任务 | 有已设定的任务 | 右上角显示任务数徽标 |

### 1.4 Props

```typescript
interface SchedButtonProps {
  disabled: boolean;
  pendingCount: number;
  nextScheduledAt?: string;  // ISO 时间，用于倒计时
  onClick: () => void;
}
```

### 1.5 交互

- **点击**：打开/关闭面板
- **悬停**：tooltip 显示"定时发送"或下次发送时间

---

## 2. SchedPanel（配置面板）

### 2.1 描述

定时发送的配置面板，包含智能时段和自定义时间两个标签页。

### 2.2 布局

```
┌─────────────────────────────────────┐
│  ⏰ 定时提醒                    [✕]  │
├─────────────────────────────────────┤
│  [智能时段]  [自定义时间]            │
├─────────────────────────────────────┤
│  ┌─ 内容区 ───────────────────────┐  │
│  │                                │  │
│  │  （智能时段/自定义时间表单）    │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                     │
│  ┌─ 预览卡片 ─────────────────────┐  │
│  │  时间：8月19日 周四 14:00      │  │
│  │  约 2 小时后                   │  │
│  │  内容："记得检查构建结果"       │  │
│  └────────────────────────────────┘  │
│                                     │
│  ┌─ 已设定任务 ───────────────────┐  │
│  │  ● 今天 14:00  检查构建    [✕] │  │
│  │  ● 今天 18:00  日报提醒    [✕] │  │
│  └────────────────────────────────┘  │
│                                     │
│  [+ 加入 · 14:00 发送]  [清空输入框] │
└─────────────────────────────────────┘
```

### 2.3 智能时段标签页

| 元素 | 说明 |
|---|---|
| 工作时间 | 显示"09:00 – 18:00"，可编辑 |
| 午休时间 | 显示"12:00 – 14:00"，可编辑 |
| 下次可送 | 自动计算并显示 |
| 编辑时段 | 弹出时段配置弹窗 |

### 2.4 自定义时间标签页

| 元素 | 说明 |
|---|---|
| 日期选择 | 今天/明天/后天 + 原生日期选择器 |
| 时间选择 | 时间输入框 + 快捷按钮（09:00, 12:00, 18:00） |
| 时区显示 | 当前时区，可切换 |

### 2.5 Props

```typescript
interface SchedPanelProps {
  open: boolean;
  mode: 'smart' | 'custom';
  schedules: ScheduleView[];
  onClose: () => void;
  onCreate: (input: UserScheduleCreateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

---

## 3. CountdownChip（倒计时芯片）

### 3.1 描述

工具行常驻显示的倒计时芯片。

### 3.2 位置

```
输入框右侧，SchedButton 旁边：
[⏰ 14:00 (2)] [✕]
  │         │    │
  │         │    └── 取消全部
  │         └────── 任务数量
  └─────────────── 下次发送时间
```

### 3.3 状态

| 状态 | 视觉 |
|---|---|
| 正常 | 天蓝背景，白色文字 |
| 紧急（<5 分钟） | 橙色背景，脉冲动画 |
| 逾期 | 红色背景 |

### 3.4 Props

```typescript
interface CountdownChipProps {
  nextScheduledAt: string;
  pendingCount: number;
  onCancelAll: () => void;
}
```

---

## 4. TaskList（任务列表）

### 4.1 描述

面板内显示已设定任务的列表。

### 4.2 任务项结构

```
┌─────────────────────────────────────┐
│  ● 今天 14:00  检查构建结果    [✕]  │
│    2 小时后发送                     │
├─────────────────────────────────────┤
│  ● 今天 18:00  日报提醒        [✕]  │
│    6 小时后发送                     │
└─────────────────────────────────────┘
```

### 4.3 状态

| 状态 | 视觉 |
|---|---|
| scheduled | 蓝色圆点 |
| overdue | 橙色圆点 + 闪烁 |
| delivered | 绿色圆点（3 秒后消失） |
| cancelled | 灰色删除线 |

### 4.4 Props

```typescript
interface TaskListProps {
  items: ScheduleView[];
  onDelete: (id: string) => void;
}
```

---

## 5. DateTimePicker（日期时间选择器）

### 5.1 描述

自定义日期和时间的选择组件。

### 5.2 日期选择

- 快捷按钮：今天、明天、后天
- 原生 `<input type="date">` 回退
- 过去日期不可选

### 5.3 时间选择

- 时间输入框：`HH:MM` 格式
- 快捷按钮：09:00, 12:00, 18:00, 22:00
- 已过时间自动顺延一天

### 5.4 Props

```typescript
interface DateTimePickerProps {
  value: { date: string | null; time: string };
  onChange: (value: { date: string | null; time: string }) => void;
  timeZone: string;
}
```

---

## 6. 插件设置卡（SchedulerSettingsCard）

### 6.1 描述

`DSH 设置 → 插件 → Session Scheduler` 出现的设置卡。视觉对齐官方 `PluginCard`，由 `dsh-client-ui-settings-plugins` 私有组件实现，本插件同构自实现以确保 Web Profile 可装。

### 6.2 字段（自上而下）

| key | 类型 | 默认 | 说明 |
|---|---|---|---|
| `maxSchedules` | number ≥1 | 100 | 单会话任务上限 |
| `allowLongPrompts` | boolean | `false` | 解除默认 1000 字符下限 |
| `maxPromptChars` | number ≥1 | 1000 | 提示字符上限（仅 `allowLongPrompts=true` 时生效） |
| `workStart` | HH:mm | `09:00` | 智能时段：工作开始 |
| `workEnd` | HH:mm | `18:00` | 智能时段：工作结束 |
| `lunchStart` | HH:mm | `12:00` | 智能时段：午休开始 |
| `lunchEnd` | HH:mm | `14:00` | 智能时段：午休结束 |
| `eveningEnd` | HH:mm | `22:00` | 智能时段：晚间结束 |

### 6.3 `allowLongPrompts` 与 `maxPromptChars` 联动

- `allowLongPrompts=false`（默认）→ `maxPromptChars` 输入框**禁用**且灰显，提示「开启「允许长文本」后可调」。
- `allowLongPrompts=true` → `maxPromptChars` 输入框启用；非法值（NaN/负数/小数/非整数）在卡片内校验失败，阻断保存。
- 切换 `allowLongPrompts` 时不自动修改 `maxPromptChars` 数值——只在开启后让该字段生效。
- 错误提示跟随微文案（见 `docs/ui/08-microcopy.md §6`）。

### 6.4 Props（参考）

```typescript
interface SchedulerSettingsCardProps {
  scope: SchedulerSettingsScopeLike;
  t: SchedulerSettingsStrings;
}
```

### 6.5 数据流

`useSchedulerSettings(scope)` 订阅宿主稳定快照 → 派生 `promptLimits` 与 `smartWindow`。设置卡保存 → 宿主替换快照引用 → 客户端立刻看到新上限：

- SchedPanel `handleConfirm` 的 `promptLimits.maxChars` 立即变化。
- `user_schedule_create` 工具 description 由 host 在每次 register 时按 `getSettings()` 现读现拼，保证模型看到的上限与代码一致。
- `/schedule` / `/later` 命令的 `parseScheduleInput` 接收 `limits`，错误消息的 `1000`/`4000` 等数字与实际生效值同步。

---

## 参考链接

- dsh-sleep-send 组件: https://github.com/Awu12277/dsh-sleep-send
- DSH 组件规范: https://deepseek-harness.github.io/deepseek-harness/develop/basic/
- React 组件最佳实践: https://react.dev/learn
