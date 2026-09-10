# 无障碍与国际化

---

## 1. 无障碍（Accessibility）

### 1.1 键盘导航

| 快捷键 | 行为 |
|---|---|
| `Tab` | 在按钮/输入框间顺序聚焦 |
| `Shift+Tab` | 反向聚焦 |
| `Enter` | 触发聚焦的按钮 |
| `Space` | 展开/折叠面板 |
| `Esc` | 关闭面板 |
| `Backspace` | 删除选中的任务 |

### 1.2 焦点管理

- 所有可交互元素必须可通过键盘访问
- 焦点不能被困在面板内（Esc 必须能关闭）
- 焦点必须可见（`:focus-visible` 样式）

```css
.ss-btn:focus-visible {
  outline: 2px solid var(--ss-accent);
  outline-offset: 2px;
}
```

### 1.3 ARIA 标签

```html
<button aria-label="设置定时发送" aria-haspopup="dialog">
  <span aria-hidden="true">⏰</span>
</button>

<div role="dialog" aria-label="定时发送配置" aria-modal="true">
  ...
</div>

<div role="status" aria-live="polite">
  下次发送：14:00（约 2 小时后）
</div>
```

### 1.4 减少动画

```css
@media (prefers-reduced-motion: reduce) {
  .ss-panel, .ss-pill, .ss-dot::after {
    animation: none;
    transition: none;
  }
}
```

### 1.5 色彩对比

| 元素 | 对比度 | 标准 |
|---|---|---|
| 正文文字 | ≥ 4.5:1 | WCAG AA |
| 大文字/按钮 | ≥ 3:1 | WCAG AA |
| 焦点指示器 | ≥ 3:1 | WCAG AA |

---

## 2. 国际化（i18n）

### 2.1 支持的语言

| 语言 | 代码 | 优先级 |
|---|---|---|
| 简体中文 | `zh-CN` | P0 |
| 英语 | `en` | P0 |
| 繁体中文 | `zh-TW` | P1 |
| 日语 | `ja` | P2 |

### 2.2 翻译策略

```typescript
// 使用 Intl API 处理时间/日期
const formatter = new Intl.DateTimeFormat(locale, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// 相对时间
const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
rtf.format(2, 'hour'); // "2 小时后"
```

### 2.3 RTL 支持

面板布局需支持 RTL（从右到左）语言：

```css
.ss-panel {
  /* 使用逻辑属性 */
  inset-inline-start: 0;
  padding-inline: 16px;
}
```

---

## 3. 响应式设计

### 3.1 断点

| 断点 | 宽度 | 布局 |
|---|---|---|
| 桌面 | ≥ 768px | 面板右侧展开 |
| 移动 | < 768px | 面板全屏覆盖 |

### 3.2 触摸优化

- 按钮最小触摸目标：44x44px
- 时间选择器适配触摸（非 hover）
- 滑动删除任务列表项

---

## 参考链接

- WAI-ARIA 实践: https://www.w3.org/WAI/ARIA/apg/
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- MDN 无障碍: https://developer.mozilla.org/zh-CN/docs/Web/Accessibility
- Intl API: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Intl
