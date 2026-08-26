/**
 * `userSchedules` 会话投影：宿主侧维护的「用户创建的、当前活动的定时提醒」，
 * 通过 `session/projection` 帧实时推给客户端（GUI 用 `useProjection` 读取）。
 *
 * fold 输入两路事件：
 *  - `schedule/change`：dsh-schedule 的严格 v1 事件（我们写入时与其完全兼容），
 *    用其导出的 `decodeScheduleChange` 解码；
 *  - `session-scheduler/user-schedule`：本插件自有的所有权记录（哪种来源）。
 *
 * fork 隔离：`session/end-seed` 标记派生会话的耐久边界。投影在遇到该事件时
 * 重置自身状态（清空 owned/active），因此子会话不继承父会话的提醒（AC-07）。
 *
 * 注意 `apply` 为增量 fold：无关事件必须返回同一状态引用，否则会误触发推送。
 * @module dsh-session-scheduler/projection
 */
import { z } from 'zod';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { decodeScheduleChange, resolveEveryOccurrence } from '@deepseek-ai/dsh-schedule';
import type { ScheduleRecord } from '@deepseek-ai/dsh-schedule';
import { OWNED_EVENT, PROJECTION_KEY } from './domain.js';
import type {
  UserScheduleOwnedChange,
  UserScheduleProjectionValue,
  UserScheduleWireItem,
} from './domain.js';

/** 单条 wire 项 schema。 */
const wireItemSchema = z
  .object({
    id: z.string(),
    kind: z.union([z.literal('after'), z.literal('at'), z.literal('every')]),
    prompt: z.string(),
    after_seconds: z.number().optional(),
    every_seconds: z.number().optional(),
    scheduled_at: z.string(),
    created_at: z.string().optional(),
    delivery_mode: z.literal('session-local'),
  })
  .strict();

/** 投影 wire 值 schema（wire.viewSchema：离开宿主前校验客户端载荷）。 */
export const userSchedulesSchema = z
  .object({
    schedules: z.array(wireItemSchema),
  })
  .strict();

/**
 * 投影内部状态 schema（stateSchema）。
 *
 * 契约要求内部状态是 plain JSON（持久化投影缓存的前提），因此 owned/active
 * 用数组而非 Set/Map 表达。
 */
const scheduleRecordStateSchema = z
  .object({
    id: z.string(),
    kind: z.union([z.literal('after'), z.literal('at'), z.literal('every')]),
    prompt: z.string(),
    afterSeconds: z.number().optional(),
    everySeconds: z.number().optional(),
    scheduledAt: z.string(),
    createdAt: z.number().optional(),
  })
  .passthrough();

export const userSchedulesStateSchema = z.object({
  /** 用户工具创建的 schedule id 集合（数组承载集合语义）。 */
  owned: z.array(z.string()),
  /** 当前活动记录（保持首现顺序，view 侧再排序）。 */
  active: z.array(scheduleRecordStateSchema),
  /** 已见 `session/end-seed` 的 seq；更早的继承前缀一律忽略。 */
  seedSeq: z.number(),
});

/** 活动存储记录：dsh-schedule 记录 + 创建时刻（来自 create 事件的 time）。 */
export type StoredScheduleRecord = ScheduleRecord & { readonly createdAt?: number };

/** 投影内部状态（plain JSON：owned/active 用数组承载）。 */
export interface UserScheduleProjectionState {
  /** 用户工具创建的 schedule id 集合。 */
  readonly owned: readonly string[];
  /** 当前活动记录（按 schedule/change 严格 fold）。 */
  readonly active: readonly StoredScheduleRecord[];
  /** 已见 `session/end-seed` 的 seq；更早的继承前缀一律忽略。 */
  readonly seedSeq: number;
}

/** 空日志初始状态。 */
export function initUserScheduleProjection(): UserScheduleProjectionState {
  return { owned: [], active: [], seedSeq: -1 };
}

/** 序列化一条活动记录为 wire 项（不含随墙钟变化的状态）。 */
function wireItemOf(record: StoredScheduleRecord): UserScheduleWireItem {
  return {
    id: record.id,
    kind: record.kind,
    prompt: record.prompt,
    ...(record.kind === 'after' ? { after_seconds: record.afterSeconds } : {}),
    ...(record.kind === 'every' ? { every_seconds: record.everySeconds } : {}),
    ...(typeof record.createdAt === 'number' ? { created_at: new Date(record.createdAt).toISOString() } : {}),
    scheduled_at: record.scheduledAt,
    delivery_mode: 'session-local',
  };
}

/** 对 `every` dispatch 推进 scheduledAt（与 dsh-schedule dispatchedRecord 一致）。 */
function advanceEvery(record: ScheduleRecord, acceptedAt: string): ScheduleRecord | undefined {
  if (record.kind !== 'every') return record;
  const occurrence = resolveEveryOccurrence(record, Date.parse(acceptedAt));
  if (occurrence.nextScheduledAt === undefined) return undefined;
  return { ...record, scheduledAt: occurrence.nextScheduledAt } as ScheduleRecord;
}

/**
 * 增量 fold。返回同一引用当事件无关；返回新状态当 owned/active 发生变化。
 */
export function applyUserScheduleProjection(
  state: UserScheduleProjectionState,
  event: SessionEvent,
): UserScheduleProjectionState {
  // 派生会话边界：重置自身，忽略继承前缀（AC-07 fork 隔离）。
  if (event.type === 'session/end-seed') {
    if (state.seedSeq === event.seq && state.owned.length === 0 && state.active.length === 0) return state;
    return { owned: [], active: [], seedSeq: event.seq };
  }
  if (seedIsBefore(state, event)) return state;

  if (event.type === OWNED_EVENT) {
    const data = event.data as unknown as UserScheduleOwnedChange;
    if (typeof data !== 'object' || data === null || data.version !== 1) return state;
    if (data.operation === 'add') {
      if (state.owned.includes(data.id)) return state;
      return { owned: [...state.owned, data.id], active: state.active, seedSeq: state.seedSeq };
    }
    if (data.operation === 'remove') {
      if (!state.owned.includes(data.id)) return state;
      return {
        owned: state.owned.filter((id) => id !== data.id),
        active: state.active,
        seedSeq: state.seedSeq,
      };
    }
    return state;
  }

  if (event.type === 'schedule/change') {
    let change;
    try {
      change = decodeScheduleChange(event.data);
    } catch {
      return state; // 无法解码的事件跳过（dsh-schedule 自身的 fold 会严格报错）
    }
    switch (change.operation) {
      case 'create': {
        const record = change.schedule as StoredScheduleRecord;
        // 固化创建时刻（事件 time），供客户端进度条按真实起点计算
        const withCreated: StoredScheduleRecord =
          typeof event.time === 'number' ? { ...record, createdAt: event.time } : record;
        const existing = state.active.find((entry) => entry.id === record.id);
        if (existing === withCreated) return state;
        return {
          owned: state.owned,
          active: existing === undefined
            ? [...state.active, withCreated]
            : state.active.map((entry) => (entry.id === record.id ? withCreated : entry)),
          seedSeq: state.seedSeq,
        };
      }
      case 'delete': {
        if (!state.active.some((entry) => entry.id === change.id)) return state;
        return {
          owned: state.owned,
          active: state.active.filter((entry) => entry.id !== change.id),
          seedSeq: state.seedSeq,
        };
      }
      case 'dispatch': {
        const current = state.active.find((entry) => entry.id === change.id);
        if (current === undefined) return state;
        let nextActive: readonly StoredScheduleRecord[];
        if ('acceptedAt' in change) {
          const advanced = advanceEvery(current, change.acceptedAt);
          // 周期推进后保留 createdAt（进度条起点跨周期不变）
          const next = advanced === undefined ? undefined : { ...advanced, createdAt: current.createdAt };
          if (next === undefined) {
            nextActive = state.active.filter((entry) => entry.id !== change.id);
          } else {
            nextActive = state.active.map((entry) => (entry.id === change.id ? next : entry));
          }
        } else {
          nextActive = state.active.filter((entry) => entry.id !== change.id);
        }
        if (nextActive === state.active) return state;
        return { owned: state.owned, active: nextActive, seedSeq: state.seedSeq };
      }
      /* c8 ignore next 2 -- decodeScheduleChange 是闭包联合 */
      default:
        return state;
    }
  }

  return state;
}

function seedIsBefore(state: UserScheduleProjectionState, event: SessionEvent): boolean {
  return state.seedSeq >= 0 && typeof event.seq === 'number' && event.seq < state.seedSeq;
}

/** 投影 view：只暴露用户创建的、当前活动的记录。 */
export function viewUserScheduleProjection(
  state: UserScheduleProjectionState,
): UserScheduleProjectionValue {
  const schedules = state.active
    .filter((record) => state.owned.includes(record.id))
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    .map(wireItemOf);
  return { schedules };
}

/**
 * 投影单元声明（传给 sessionProjections.register）。
 *
 * 形状必须匹配 `ProjectionDefinition`：
 *  - `stateSchema`（不是 schema）：宿主持久化缓存恢复前校验内部状态；
 *  - `wire: { viewSchema, view }`（不是顶层 view）：**只有带 wire 的单元才是
 *    client-visible 的**——`snapshot()`/变更帧都会跳过无 wire 的单元，
 *    客户端 `useProjection(key)` 将永远读到 undefined。
 */
export const userSchedulesProjectionUnit = {
  key: PROJECTION_KEY,
  stateSchema: userSchedulesStateSchema,
  init: initUserScheduleProjection,
  apply: applyUserScheduleProjection,
  wire: {
    viewSchema: userSchedulesSchema,
    view: viewUserScheduleProjection,
  },
  // v2：active 记录新增 createdAt（进度条真实起点）；旧缓存行按版本丢弃
  stateVersion: 2,
} as const;
