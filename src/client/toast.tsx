/**
 * 轻量提醒到达 toast：插件级微型横幅（不依赖宿主 toast 系统）。
 *
 * 设计：模块级 store + 一个由 client apply() 挂载到 <body> 的根组件。
 * 任何代码（dock 的 dispatch 检测、面板等）调用 `showReminderToast(text)`
 * 即可弹出一条 5 秒后自动消失的提示。
 *
 * 为何不用宿主 toast：当前 rc.7 客户端没有对插件的通用通知通道，
 * conversationEvents.register 需要同时提供 target+buildViewNode（会与核心
 * 的 input-message 节点竞争），因此采用投影差异检测 + 自有横幅的最简方案。
 * @module dsh-later/client/toast
 */
import type { JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';

interface ToastItem {
  readonly id: number;
  readonly text: string;
}

const listeners = new Set<(items: readonly ToastItem[]) => void>();
let items: readonly ToastItem[] = [];
let nextId = 1;

function emit(): void {
  for (const listener of listeners) listener(items);
}

/** 弹一条提醒 toast（标 `临时`，5 秒后自动消失）。 */
export function showReminderToast(text: string, ttlMs = 5000): void {
  const id = nextId++;
  const item: ToastItem = { id, text };
  items = [...items, item];
  emit();
  window.setTimeout(() => {
    items = items.filter((existing) => existing.id !== id);
    emit();
  }, ttlMs);
}

function useToasts(): readonly ToastItem[] {
  const [state, setState] = useState<readonly ToastItem[]>(items);
  useEffect(() => {
    const listener = (next: readonly ToastItem[]): void => setState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}

/** 挂载一次到 document.body；需在 client apply() 里调用一次。 */
export function ReminderToastHost(): JSX.Element | null {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="ss-toast-host" data-ss-toast="">
      {toasts.map((item) => (
        <div key={item.id} className="ss-toast" role="status">
          <span className="ss-toast-icon" aria-hidden="true">⏰</span>
          <span className="ss-toast-text">{item.text}</span>
        </div>
      ))}
    </div>
  );
}

let mounted = false;
/** 挂载 toast 宿主（幂等）。返回卸载函数。 */
export function mountReminderToastHost(): () => void {
  if (mounted) return () => undefined;
  mounted = true;
  const host = document.createElement('div');
  host.setAttribute('data-ss-toast-root', '');
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<ReminderToastHost />);
  return () => {
    root.unmount();
    host.remove();
    mounted = false;
  };
}
