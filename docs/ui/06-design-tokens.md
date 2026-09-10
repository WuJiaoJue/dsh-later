# Design Tokens

---

## 1. 颜色

### 1.1 主色（Primary）

| Token | 浅色模式 | 深色模式 | 用途 |
|---|---|---|---|
| `--ss-primary` | `#3b82f6` | `#60a5fa` | 主按钮、活动状态 |
| `--ss-primary-hover` | `#2563eb` | `#93c5fd` | 悬停状态 |
| `--ss-primary-active` | `#1d4ed8` | `#bfdbfe` | 按下状态 |

### 1.2 状态色

| Token | 浅色模式 | 深色模式 | 用途 |
|---|---|---|---|
| `--ss-success` | `#22c55e` | `#4ade80` | 成功/已发送 |
| `--ss-warning` | `#f59e0b` | `#fbbf24` | 警告/逾期 |
| `--ss-danger` | `#ef4444` | `#f87171` | 错误/删除 |
| `--ss-info` | `#06b6d4` | `#22d3ee` | 信息/提示 |

### 1.3 中性色

| Token | 浅色模式 | 深色模式 | 用途 |
|---|---|---|---|
| `--ss-bg` | `#ffffff` | `#1e1e1e` | 面板背景 |
| `--ss-surface` | `#f8fafc` | `#2d2d2d` | 卡片背景 |
| `--ss-border` | `#e2e8f0` | `#404040` | 边框 |
| `--ss-text` | `#1e293b` | `#f1f5f9` | 主文字 |
| `--ss-text-secondary` | `#64748b` | `#94a3b8` | 次文字 |

---

## 2. 字体

### 2.1 字号

| Token | 值 | 用途 |
|---|---|---|
| `--ss-text-xs` | `0.75rem` (12px) | 辅助文字、时间戳 |
| `--ss-text-sm` | `0.875rem` (14px) | 次文字、按钮 |
| `--ss-text-base` | `1rem` (16px) | 正文、输入 |
| `--ss-text-lg` | `1.125rem` (18px) | 标题 |

### 2.2 字重

| Token | 值 | 用途 |
|---|---|---|
| `--ss-font-normal` | `400` | 正文 |
| `--ss-font-medium` | `500` | 按钮、标签 |
| `--ss-font-semibold` | `600` | 标题、强调 |

---

## 3. 间距

| Token | 值 | 用途 |
|---|---|---|
| `--ss-space-xs` | `0.25rem` (4px) | 紧凑间距 |
| `--ss-space-sm` | `0.5rem` (8px) | 组件内间距 |
| `--ss-space-md` | `1rem` (16px) | 组件间间距 |
| `--ss-space-lg` | `1.5rem` (24px) | 区块间距 |

---

## 4. 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--ss-radius-sm` | `0.25rem` (4px) | 标签、小按钮 |
| `--ss-radius-md` | `0.5rem` (8px) | 按钮、输入框 |
| `--ss-radius-lg` | `1rem` (16px) | 面板、卡片 |

---

## 5. 阴影

| Token | 值 | 用途 |
|---|---|---|
| `--ss-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 轻微浮起 |
| `--ss-shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | 面板、弹窗 |
| `--ss-shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | 模态框 |

---

## 6. 动效

### 6.1 时长

| Token | 值 | 用途 |
|---|---|---|
| `--ss-duration-fast` | `150ms` | 微交互（悬停、聚焦） |
| `--ss-duration-normal` | `300ms` | 面板开合 |
| `--ss-duration-slow` | `500ms` | 复杂动画 |

### 6.2 缓动

| Token | 值 | 用途 |
|---|---|---|
| `--ss-ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 进入动画 |
| `--ss-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 退出动画 |
| `--ss-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 双向动画 |

### 6.3 减少动画

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. 响应式断点

| Token | 值 | 用途 |
|---|---|---|
| `--ss-breakpoint-sm` | `640px` | 小屏幕手机 |
| `--ss-breakpoint-md` | `768px` | 平板 |
| `--ss-breakpoint-lg` | `1024px` | 桌面 |

---

## 8. Z-Index

| Token | 值 | 用途 |
|---|---|---|
| `--ss-z-panel` | `100` | 配置面板 |
| `--ss-z-popover` | `200` | 弹窗 |
| `--ss-z-tooltip` | `300` | 提示 |
| `--ss-z-modal` | `400` | 模态框 |

---

## 参考链接

- Design Tokens 规范: https://designtokens.org/
- W3C CSS 变量: https://www.w3.org/TR/css-variables-1/
- Tailwind CSS Tokens: https://tailwindcss.com/docs/theme
