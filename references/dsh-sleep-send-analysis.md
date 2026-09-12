# dsh-sleep-send 深度源码分析

> 本文件分析 `dsh-sleep-send` 的实现，作为 later 插件的 GUI 参考。

---

## 1. 包结构

```
dsh-sleep-send/
├── index.js          ← host 侧骨架（仅 3 行有效代码）
├── client.js         ← 浏览器端实现（全部逻辑）
├── cordis.patch.yml  ← bundle patch
├── package.json
└── docs/
    └── screenshots/  ← 截图
```

**关键发现**：这是一个**纯客户端插件**，host 侧无逻辑。

---

## 2. 核心实现

### 2.1 存储：localStorage

```javascript
const LS_KEY = "dsh.sched-send.v1";
const LS_GRACE = 15 * 60 * 1000;  // 15 分钟宽限期（硬编码）

function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null
  } catch { return null; }
}
```

**局限**：
- 换浏览器 → 丢失
- 无痕模式 → 丢失
- 清除站点数据 → 丢失

### 2.2 智能时段（硬编码）

```javascript
// 可用发送时段：12:00–14:00、18:00–次日 08:00（含端点）
const inWindow = (m) => (m >= 12 * 60 && m <= 14 * 60) || (m >= 18 * 60 || m <= 8 * 60);
const nextAutoTarget = (now) => {
  const floor = new Date(now + 2 * MIN_MS);  // 至少 2 分钟后
  floor.setSeconds(0, 0);
  const m = floor.getHours() * 60 + floor.getMinutes();
  if (inWindow(m)) return floor.getTime();
  const d = new Date(floor);
  if (m < 12 * 60) d.setHours(12, 0, 0, 0);
  else if (m < 18 * 60) d.setHours(18, 0, 0, 0);
  else d.setHours(12, 0, 0, 0);  // bug: 应该是次日 12:00
  return d.getTime();
};
```

**潜在 bug**：`else` 分支如果当前是 22:00，设置今天 12:00 会变成过去时间。应该是 `d.setDate(d.getDate()+1)`。

### 2.3 调度：1 秒轮询

```javascript
timer.interval(() => {
  const now = Date.now();
  store.schedules.forEach((list, sid) => {
    const due = list.filter((s) => now >= s.target);
    // ...
  });
}, 1000);
```

**局限**：每秒扫描所有任务，资源浪费。应使用精确 `setTimeout`。

### 2.4 发送：操控输入框

```javascript
async function fire(sid, s) {
  // 防覆盖检查
  const current = snapshot ? snapshot.draft : "";
  if (current !== "" && current !== s.text) {
    markRecent(sid, false, "输入框内容已变更");
    return;
  }
  // 操控输入框发送
  actions.setDraft(s.text);
  actions.submit();
  markRecent(sid, true, s.text);
}
```

**风险**：如果 React 状态没来得及更新，或者输入框被用户聚焦，可能出问题。

### 2.5 CSS 注入

```javascript
const styleEl = document.createElement("style");
styleEl.id = "dsh-sleep-send-styles";
styleEl.textContent = css;  // 硬编码 CSS 字符串
document.head.appendChild(styleEl);
```

**问题**：
- 没有 cleanup（卸载时样式残留）
- 硬编码主题色，不跟随系统主题
- 可能和主题插件冲突

---

## 3. 设计亮点

| 亮点 | 说明 | 是否值得借鉴 |
|---|---|---|
| 纯客户端架构 | 零服务端依赖 | ✅ 简单部署 |
| 防覆盖逻辑 | 发送前检查输入框是否被修改 | ✅ 本插件复用 |
| 智能时段 | 不在尴尬时间发消息 | ✅ 本插件改为可配置 |
| 可访问性 | focus-visible + prefers-reduced-motion | ✅ 本插件复用 |
| 会话隔离 | `Map<sessionId, List>` | ✅ 天然支持 |

---

## 4. 设计缺陷

| 缺陷 | 影响 | 本插件是否犯同样错 |
|---|---|---|
| localStorage 存储 | 关网页即死 | ❌ 用 session 事件日志 |
| 1 秒轮询 | 资源浪费 | ❌ 用服务端 timer |
| 操控输入框 | 不稳定 | ❌ 用 followup 注入 |
| 15 分钟魔法数字 | 无法配置 | ❌ 合理默认 + 可配置 |
| CSS 直接注入 | 冲突风险 | ❌ CSS Modules |
| 发送失败无重试 | 消息丢失 | ❌ 有日志可追溯 |

---

## 5. 竞品数据

| 指标 | 数值 |
|---|---|
| Stars | 2 |
| Forks | 0 |
| Issues | 0 |
| 创建时间 | 2026-08-17 |
| 最后更新 | 2026-08-19 |

---

## 参考链接

- GitHub: https://github.com/Awu12277/dsh-sleep-send
- npm: https://www.npmjs.com/package/dsh-sleep-send
- 插件详情: https://awesome-dsh-plugin.com/p/Awu12277/dsh-sleep-send/
- 源码（index.js）: https://raw.githubusercontent.com/Awu12277/dsh-sleep-send/main/index.js
- 源码（client.js）: https://raw.githubusercontent.com/Awu12277/dsh-sleep-send/main/client.js
