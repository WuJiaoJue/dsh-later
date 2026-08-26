/**
 * localStorage 降级存储（PRD v1.0.0 P1）。
 *
 * 职责：
 *  - 网络中断时，用户创建的任务先落 localStorage，避免丢失
 *  - 页面重载后，从 localStorage 恢复未同步到服务端的任务
 *  - 网络恢复后，自动将本地暂存任务同步到服务端（通过 slash 命令）
 *
 * 幂等设计：每个本地任务带 `clientSeq` 去重键，同步成功后才删除；
 * 服务端已存在（投影中可见）的本地副本也会安全清理。
 * @module dsh-session-scheduler/client/local-store
 */
import type { CreateCommandPayload } from './types.js';

/** localStorage key。 */
const STORAGE_KEY = 'dsh-session-scheduler:pending';

/** 本地暂存任务。 */
export interface PendingSchedule {
  /** 客户端自增序号（去重键）。 */
  readonly clientSeq: number;
  /** 创建时间戳（epoch ms）。 */
  readonly createdAt: number;
  /** 创建载荷（与 slash 命令体一致）。 */
  readonly payload: CreateCommandPayload;
}

/** 读取全部暂存（容错解析）。 */
export function readPending(): PendingSchedule[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingSchedule);
  } catch {
    return [];
  }
}

/** 写入全部暂存。 */
export function writePending(pending: readonly PendingSchedule[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    /* 配额超限等：静默降级 */
  }
}

/** 追加一条暂存。 */
export function appendPending(payload: CreateCommandPayload): PendingSchedule {
  const pending = readPending();
  const clientSeq = pending.reduce((max, item) => Math.max(max, item.clientSeq), 0) + 1;
  const item: PendingSchedule = { clientSeq, createdAt: Date.now(), payload };
  writePending([...pending, item]);
  return item;
}

/** 移除指定 clientSeq 的暂存。 */
export function removePending(clientSeq: number): void {
  const pending = readPending().filter((item) => item.clientSeq !== clientSeq);
  writePending(pending);
}

/** 清空全部暂存。 */
export function clearPending(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 静默降级 */
  }
}

/** 类型守卫。 */
function isPendingSchedule(value: unknown): value is PendingSchedule {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['clientSeq'] === 'number' &&
    typeof v['createdAt'] === 'number' &&
    typeof v['payload'] === 'object' &&
    v['payload'] !== null
  );
}
