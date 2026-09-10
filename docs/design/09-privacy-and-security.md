# 隐私与安全

---

## 1. 数据安全

### 1.1 存储位置

| 数据 | 存储位置 | 可见范围 |
|---|---|---|
| 提醒任务 | Session 事件日志（服务端 JSONL） | 仅 session 所有者 |
| 用户偏好 | Session 同上 | 仅 session 所有者 |
| 临时状态 | React 状态（内存） | 当前页面 |

**不存储在 localStorage**（跨标签页同步问题）。

### 1.2 数据生命周期

```
创建 → session 事件日志持久化
删除 → session 事件日志追加 delete 事件（不物理删除，append-only）
过期 → session 事件日志追加 dispatch 事件
session 终止 → 日志归档，可按需清理
```

---

## 2. 注入防护

### 2.1 用户输入转义

```typescript
// 提醒内容必须 JSON.stringify 后嵌入 framing
reminder_prompt_json: JSON.stringify(prompt)
```

### 2.2 模型 framing 不可伪造

```typescript
// 事件日志有 source 字段区分来源
interface UserScheduleCreateChange {
  source: 'user-tool';  // 用户创建的标记
}

interface ModelScheduleCreateChange {
  source: 'model-tool';  // 模型创建的标记
}

// 渲染时只展示 source: 'user-tool' 的
```

### 2.3 XSS 防护

- React 默认 escape 所有动态内容
- 不使用 `dangerouslySetInnerHTML`
- 不使用 `eval` 或 `new Function`

---

## 3. 操作安全

### 3.1 防误操作

| 场景 | 防护 |
|---|---|
| 误删任务 | 删除前确认弹窗 |
| 误创建 | 可撤销（5 秒内） |
| 批量操作 | 需二次确认 |
| 清空全部 | 需二次确认 |

### 3.2 配额限制

| 限制 | 值 | 原因 |
|---|---|---|
| 单 session 任务数 | 100 | 防止滥用 |
| 单次创建间隔 | 1 秒 | 防止洪水 |
| 提醒内容长度 | 1000 字符 | 防止滥用 |
| 固定间隔最低 | 5 分钟 | 防止过于频繁 |

---

## 4. 安全审计

### 4.1 审计日志

```typescript
// 所有操作记录到 session 事件日志
{
  type: 'schedule/change',
  operation: 'create',
  source: 'user-tool',
  user: 'user-id',  // 操作者
  timestamp: '2026-08-19T14:00:00Z',
  schedule: { ... }
}
```

### 4.2 敏感操作

| 操作 | 需要确认 | 需要认证 |
|---|---|---|
| 创建任务 | 否 | 是（session 登录） |
| 删除任务 | 是 | 是 |
| 清空全部 | 是 | 是 |
| 导出日志 | 否 | 是 |

---

## 5. 第三方依赖安全

| 依赖 | 来源 | 风险 |
|---|---|---|
| `@deepseek-ai/cordis` | 官方 | 低 |
| `@deepseek-ai/dsh-schedule` | 官方 | 低 |
| `react` | npm | 低 |

定期审计依赖漏洞：`npm audit`

---

## 参考链接

- dsh-schedule 注入防护: [本地文件](/home/wujue/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-schedule/README.zh.md)
- OWASP XSS 防护: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- React 安全: https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html
