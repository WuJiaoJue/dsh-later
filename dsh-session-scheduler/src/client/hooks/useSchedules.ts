/**
 * `useSchedules` hook：封装投影读取、命令调用、面板定位与 localStorage 降级。
 *
 * 职责：
 *  - 读取 `userSchedules` 会话投影（实时任务列表）
 *  - 计算下次任务时间、任务数量、按钮启用状态
 *  - 提供创建/删除/取消全部的命令通道
 *  - 提供面板定位（相对视口底部）
 *  - 网络降级：命令失败时暂存 localStorage，网络恢复后自动同步
 *
 * 这样 `SchedButton` 只需负责渲染，逻辑复用（v1.1 跨 session 聚合视图可复用此 hook）。
 * @module dsh-session-scheduler/client/hooks/useSchedules
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientSchedule, CreateCommandPayload } from '../types.js';
import { detectTimeZone } from '../../time-utils.js';
import { useNow } from '../useCountdown.js';
import {
  appendPending,
  clearPending,
  readPending,
  removePending,
  type PendingSchedule,
} from '../local-store.js';
import { CLIENT_ERR } from '../strings.js';

/** 应用层注入的调用能力。 */
export interface UseSchedulesInject {
  /** 向宿主执行一条 slash 命令；返回是否受理。 */
  callCommand: (sessionId: string, line: string) => Promise<boolean>;
  /** 会话 id。 */
  sessionId?: string;
  /** 输入动作：清空输入框。 */
  inputActions?: { setDraft(text: string): void };
  /** 会话作用域标准 hook：读取草稿。 */
  useInput?: (selector: (state: { draft: string }) => string) => string;
  /** 会话作用域标准 hook：读取投影。 */
  useProjection?: (key: string) => { schedules?: readonly ClientSchedule[] } | undefined;
  /** InputZone owner 提供的输入快照。 */
  input?: { readonly draft: string };
}

/** 解析投影值为任务数组（容错）。 */
function schedulesOf(projection: { schedules?: readonly ClientSchedule[] } | undefined): ClientSchedule[] {
  return (projection?.schedules ?? []) as ClientSchedule[];
}

/** 构造创建/删除命令行（序列化全部非空选择器字段）。 */
const createLine = (input: CreateCommandPayload): string => {
  const body: Record<string, unknown> = { prompt: input.prompt, time_zone: detectTimeZone() };
  if (input.at !== undefined) body['at'] = input.at;
  if (input.after_seconds !== undefined) body['after_seconds'] = input.after_seconds;
  return `/user-schedule-create ${JSON.stringify(body)}`;
};
const deleteLine = (id: string): string => `/user-schedule-delete ${JSON.stringify({ id })}`;

export interface UseSchedulesResult {
  /** 当前草稿。 */
  draft: string;
  /** 当前任务列表。 */
  schedules: ClientSchedule[];
  /** 下次任务目标 epoch；undefined 表示无任务。 */
  nextEpoch: number | undefined;
  /** 按钮是否启用。 */
  enabled: boolean;
  /** 是否正在执行命令。 */
  busy: boolean;
  /** 面板底部定位（相对视口）。 */
  anchorBottom: number;
  /** 重新计算面板定位。 */
  reposition: () => void;
  /** 创建任务（带 localStorage 降级）。 */
  handleCreate: (input: CreateCommandPayload) => Promise<void>;
  /** 删除单个任务。 */
  handleDelete: (id: string) => Promise<void>;
  /** 取消全部任务。 */
  handleCancelAll: () => Promise<void>;
  /** 清空输入框。 */
  handleClearDraft: () => void;
  /** 行内 ref（用于定位）。 */
  rowRef: React.RefObject<HTMLSpanElement | null>;
}

export function useSchedules(inject: UseSchedulesInject): UseSchedulesResult {
  const { callCommand, sessionId, inputActions, input, useProjection, useInput } = inject;

  const [busy, setBusy] = useState(false);
  const [anchorBottom, setAnchorBottom] = useState<number>(80);
  const [pendingSync, setPendingSync] = useState<PendingSchedule[]>(() => readPending());
  const rowRef = useRef<HTMLSpanElement | null>(null);
  const now = useNow(1000);

  // 草稿：优先取 owner 快照；否则回退 useInput hook。
  const draft =
    input?.draft ??
    (typeof useInput === 'function' ? useInput((s) => s.draft) : '') ??
    '';

  const projection = typeof useProjection === 'function' ? useProjection('userSchedules') : undefined;
  const schedules = useMemo(() => schedulesOf(projection), [projection]);

  const nextEpoch = useMemo(() => {
    return schedules
      .map((item) => Date.parse(item.scheduled_at))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b)[0];
  }, [schedules]);

  const enabled = draft.trim().length > 0 || schedules.length > 0;

  // 注意：这里【有意没有】「草稿变更 → 自动取消任务」的逻辑（AC-06 已废弃）。
  // 该逻辑曾把「提交 /schedule 后输入框被清空」误判为草稿变更，导致刚创建的
  // 提醒在 ~40ms 内被自动删除；且与 README 的既定取舍冲突（已排定的提醒不因
  // 草稿变化而静默取消）。取消只能通过 dock ✕ / 面板列表 / 取消全部 显式触发。

  const reposition = useCallback(() => {
    const el = rowRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    setAnchorBottom(Math.max(12, window.innerHeight - rect.top + 10));
  }, []);

  // 清理已同步的本地暂存（投影中已见的 prompt 视为已同步）。
  const syncedPrompts = useMemo(() => {
    return new Set(schedules.map((item) => item.prompt));
  }, [schedules]);

  useEffect(() => {
    if (pendingSync.length === 0) return;
    const remaining = pendingSync.filter((item) => !syncedPrompts.has(item.payload.prompt));
    if (remaining.length !== pendingSync.length) {
      setPendingSync(remaining);
      writePendingLocal(remaining);
    }
  }, [syncedPrompts, pendingSync]);

  // 启动时 & 网络恢复时，自动同步暂存任务到服务端。
  useEffect(() => {
    if (pendingSync.length === 0 || !sessionId) return;
    let cancelled = false;
    const syncAll = async (): Promise<void> => {
      const items = [...pendingSync];
      for (const item of items) {
        if (cancelled) return;
        try {
          const accepted = await callCommand(sessionId, createLine(item.payload));
          if (accepted && !cancelled) {
            removePending(item.clientSeq);
            setPendingSync((prev) => prev.filter((p) => p.clientSeq !== item.clientSeq));
          }
        } catch {
          /* 保留暂存，等下次重试 */
          return;
        }
      }
    };
    void syncAll();
    const onOnline = (): void => {
      if (!cancelled) void syncAll();
    };
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, [pendingSync, sessionId, callCommand]);

  const handleCreate = useCallback(async (inputPayload: CreateCommandPayload): Promise<void> => {
    if (!sessionId) {
      // 抛稳定令牌（P1-7）：UI 层按当前 locale 翻译，hook 不依赖 locale 服务。
      throw new Error(CLIENT_ERR.NO_SESSION);
    }
    setBusy(true);
    try {
      const accepted = await callCommand(sessionId, createLine(inputPayload));
      if (!accepted) {
        // 命令未被受理（网络/宿主异常）→ 降级暂存本地
        appendPending(inputPayload);
        setPendingSync((prev) => [...prev, { clientSeq: Date.now(), createdAt: Date.now(), payload: inputPayload }]);
        throw new Error(CLIENT_ERR.NOT_ACCEPTED);
      }
    } finally {
      setBusy(false);
    }
  }, [sessionId, callCommand]);

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    if (!sessionId) return;
    await callCommand(sessionId, deleteLine(id));
  }, [sessionId, callCommand]);

  const handleCancelAll = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    await Promise.all(schedules.map((item) => callCommand(sessionId, deleteLine(item.id))));
  }, [sessionId, schedules, callCommand]);

  const handleClearDraft = useCallback((): void => {
    inputActions?.setDraft('');
  }, [inputActions]);

  return {
    draft,
    schedules,
    nextEpoch,
    enabled,
    busy,
    anchorBottom,
    reposition,
    handleCreate,
    handleDelete,
    handleCancelAll,
    handleClearDraft,
    rowRef,
  };
}

/** 写入 local（分离便于测试 mock）。 */
function writePendingLocal(pending: readonly PendingSchedule[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dsh-session-scheduler:pending', JSON.stringify(pending));
    }
  } catch {
    /* 静默降级 */
  }
}
