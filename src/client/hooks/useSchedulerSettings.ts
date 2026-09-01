/**
 * `useSchedulerSettings`：把插件设置 namespace 解析为面板可用的运行值。
 *
 * 数据流：apply 时经宿主 `settingsScope.bind({namespace})` 得到 wire scope，
 * 本 hook 用 `useSyncExternalStore` 订阅其**原始快照**（宿主保证引用稳定：
 * 仅在实际变更时替换），再经 `useMemo` 派生 `sanitizeSmartWindowConfig`
 * 清洗结果供 SchedPanel 计算智能时段——设置页保存后无须刷新即时生效。
 *
 * 稳定性约定（React 18 外部存储）：
 *  - `getSnapshot` 只读取宿主的稳定快照引用，绝不构造新对象——否则每次渲染
 *    都产生新引用，`Object.is` 比较永不相等，触发「Maximum update depth
 *    exceeded」（React #185）死循环，导致插槽条目崩溃、输入框按钮消失。
 *  - 派生值在 `useMemo` 中按原始快照引用记忆：引用不变 → 派生值稳定。
 *
 * scope 缺失或未就绪时回退内置默认时段。
 * @module dsh-session-scheduler/client/hooks/useSchedulerSettings
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { sanitizeSmartWindowConfig, DEFAULT_SMART_WINDOW, type SmartWindowConfig } from '../../smart-window.js';

/** 设置面需要的最小快照形状（与 dsh-client-runtime 的 SettingsScope 快照兼容）。 */
export interface SchedulerSettingsSnapshot {
  status: string;
  value?: Record<string, unknown>;
}

/** 设置面需要的最小 scope 形状。 */
export interface SchedulerSettingsScopeLike {
  getSnapshot(): SchedulerSettingsSnapshot;
  subscribe(callback: () => void): () => void;
}

/** 解析后的插件设置（面板视角）。 */
export interface ResolvedSchedulerSettings {
  /** 设置层是否已就绪（false = 回退默认值）。 */
  ready: boolean;
  /** 智能时段配置（非法字段已逐项回落默认）。 */
  smartWindow: SmartWindowConfig;
}

const FALLBACK: ResolvedSchedulerSettings = {
  ready: false,
  smartWindow: sanitizeSmartWindowConfig(undefined),
};

/** 解析宿主快照（引用）为面板可用值；引用不变时结果由 useMemo 稳定记忆。 */
function resolveFromSnapshot(snap: SchedulerSettingsSnapshot): ResolvedSchedulerSettings {
  if (snap.status !== 'ready') {
    return { ready: false, smartWindow: FALLBACK.smartWindow };
  }
  return {
    ready: true,
    smartWindow: sanitizeSmartWindowConfig(
      (snap.value ?? {}) as Partial<Record<keyof SmartWindowConfig, unknown>>,
    ),
  };
}

/** 用于无 scope 时的空订阅。 */
const NOOP_SUBSCRIBE = (): (() => void) => () => undefined;

/** 无 scope 时的稳定快照——单一不可变引用，任何读取都返回同一对象。 */
const EMPTY_SNAPSHOT: SchedulerSettingsSnapshot = { status: 'unavailable' };

/** 订阅插件设置并解析为面板可用值。 */
export function useSchedulerSettings(
  scope: SchedulerSettingsScopeLike | undefined,
): ResolvedSchedulerSettings {
  // getSnapshot 只返回宿主稳定的快照引用（或模块级 EMPTY_SNAPSHOT），
  // 绝不在此处构造对象——保证 useSyncExternalStore 的 Object.is 稳定。
  const getSnapshot = useCallback(
    () => (scope === undefined ? EMPTY_SNAPSHOT : scope.getSnapshot()),
    [scope],
  );
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      scope === undefined ? NOOP_SUBSCRIBE() : scope.subscribe(onStoreChange),
    [scope],
  );
  const raw = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // 派生值按原始快照引用记忆：宿主未变更 → 引用相同 → 派生值引用稳定。
  return useMemo(() => resolveFromSnapshot(raw), [raw]);
}

/** 让无设置时面板仍能拿到稳定默认（仅供内部测试或特殊兜底）。 */
export const DEFAULT_RESOLVED_SETTINGS: ResolvedSchedulerSettings = {
  ready: false,
  smartWindow: DEFAULT_SMART_WINDOW,
};
