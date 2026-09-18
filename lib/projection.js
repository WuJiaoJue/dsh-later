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
 * @module dsh-later/projection
 */
import { z } from 'zod';
import { decodeScheduleChange, resolveEveryOccurrence } from '@deepseek-ai/dsh-schedule';
import { OWNED_EVENT, PROJECTION_KEY } from './domain.js';
import { allOwnership, allPaused, findPausedByScheduleId, getOwnership, hasOwnership, } from './ownership-store.js';
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
    status: z.union([z.literal('active'), z.literal('paused')]).optional(),
    remaining_seconds: z.number().optional(),
    paused_at: z.string().optional(),
    schedule_id: z.string().optional(),
    window_seconds: z.number().optional(),
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
const pausedStateSchema = z.object({
    uid: z.string(),
    prompt: z.string(),
    delivery: z.union([z.literal('context'), z.literal('user')]),
    kind: z.literal('after'),
    remainingSeconds: z.number(),
    originalScheduledAt: z.string(),
    originalAfterSeconds: z.number().optional(),
    lastScheduleId: z.string(),
    pausedAt: z.number(),
});
export const userSchedulesStateSchema = z.object({
    /** 会话 id（init 由 header 注入；apply 据此查询所有权 sidecar 缓存）。 */
    sessionId: z.string(),
    /** 用户工具创建的 schedule id 集合（数组承载集合语义）。 */
    owned: z.array(z.string()),
    /** 当前活动记录（保持首现顺序，view 侧再排序）。 */
    active: z.array(scheduleRecordStateSchema),
    /** 已见 `session/end-seed` 的 seq；更早的继承前缀一律忽略。 */
    seedSeq: z.number(),
    /** sidecar 暂停留档镜像（v4）。 */
    paused: z.array(pausedStateSchema).default([]),
});
function pausedFromSidecar(sessionId) {
    if (sessionId.length === 0)
        return [];
    return Object.values(allPaused(sessionId));
}
/** 初始状态：按会话 id 从所有权 sidecar 装载（进程重启后恢复 GUI 归属）。 */
export function initUserScheduleProjection(header) {
    const sessionId = typeof header?.id === 'string' && header.id.length > 0 ? header.id : '';
    const entries = sessionId.length > 0 ? allOwnership(sessionId) : {};
    return {
        sessionId,
        owned: Object.keys(entries),
        active: [],
        seedSeq: -1,
        paused: pausedFromSidecar(sessionId),
    };
}
/** 序列化一条活动记录为 wire 项（id 优先稳定 uid）。 */
function wireItemOf(record, sessionId) {
    const ownership = sessionId.length > 0 ? getOwnership(sessionId, record.id) : undefined;
    const uid = ownership?.uid;
    const windowSeconds = ownership?.windowSeconds;
    return {
        id: uid ?? record.id,
        kind: record.kind,
        prompt: record.prompt,
        ...(record.kind === 'after' ? { after_seconds: record.afterSeconds } : {}),
        ...(record.kind === 'every' ? { every_seconds: record.everySeconds } : {}),
        ...(typeof record.createdAt === 'number' ? { created_at: new Date(record.createdAt).toISOString() } : {}),
        ...(record.kind === 'after' && typeof windowSeconds === 'number'
            ? { window_seconds: windowSeconds }
            : {}),
        scheduled_at: record.scheduledAt,
        delivery_mode: 'session-local',
        status: 'active',
        schedule_id: record.id,
    };
}
function pausedWireItemOf(entry) {
    const windowSec = entry.originalAfterSeconds ?? entry.remainingSeconds;
    return {
        id: entry.uid,
        kind: 'after',
        prompt: entry.prompt,
        // 进度条总窗口用原 after 间隔；remaining 单独给冻结剩余
        after_seconds: windowSec,
        window_seconds: windowSec,
        scheduled_at: entry.originalScheduledAt,
        delivery_mode: 'session-local',
        status: 'paused',
        remaining_seconds: entry.remainingSeconds,
        paused_at: new Date(entry.pausedAt).toISOString(),
        schedule_id: entry.lastScheduleId,
    };
}
/** 对 `every` dispatch 推进 scheduledAt（与 dsh-schedule dispatchedRecord 一致）。 */
function advanceEvery(record, acceptedAt) {
    if (record.kind !== 'every')
        return record;
    const occurrence = resolveEveryOccurrence(record, Date.parse(acceptedAt));
    if (occurrence.nextScheduledAt === undefined)
        return undefined;
    return { ...record, scheduledAt: occurrence.nextScheduledAt };
}
/**
 * 增量 fold。返回同一引用当事件无关；返回新状态当 owned/active 发生变化。
 */
export function applyUserScheduleProjection(state, event) {
    // 派生会话边界：重置自身，忽略继承前缀（AC-07 fork 隔离）。
    if (event.type === 'session/end-seed') {
        if (state.seedSeq === event.seq &&
            state.owned.length === 0 &&
            state.active.length === 0 &&
            state.paused.length === 0) {
            return state;
        }
        // 派生会话（fork）：sidecar 以 sessionId 隔离，派生 id 天然空表；此处再清一次
        // 兜底「同 id 重播种」场景，保持 AC-07 语义。
        const owned = state.sessionId.length > 0
            ? Object.keys(allOwnership(state.sessionId))
            : [];
        return {
            sessionId: state.sessionId,
            owned,
            active: [],
            seedSeq: event.seq,
            paused: pausedFromSidecar(state.sessionId),
        };
    }
    if (seedIsBefore(state, event))
        return state;
    if (event.type === OWNED_EVENT) {
        const data = event.data;
        if (typeof data !== 'object' || data === null || data.version !== 1)
            return state;
        if (data.operation === 'add') {
            if (state.owned.includes(data.id))
                return state;
            return {
                sessionId: state.sessionId,
                owned: [...state.owned, data.id],
                active: state.active,
                seedSeq: state.seedSeq,
                paused: state.paused,
            };
        }
        if (data.operation === 'remove') {
            if (!state.owned.includes(data.id))
                return state;
            return {
                sessionId: state.sessionId,
                owned: state.owned.filter((id) => id !== data.id),
                active: state.active,
                seedSeq: state.seedSeq,
                paused: state.paused,
            };
        }
        return state;
    }
    if (event.type === 'schedule/change') {
        let change;
        try {
            change = decodeScheduleChange(event.data);
        }
        catch {
            return state; // 无法解码的事件跳过（dsh-schedule 自身的 fold 会严格报错）
        }
        switch (change.operation) {
            case 'create': {
                const record = change.schedule;
                // 所有权判定改走 sidecar（用户工具在 append 前写 sidecar）。
                // 历史遗留：日志中的 OWNED 事件仍由上方独立分支维护（读兼容）。
                let owned = state.owned;
                if (!owned.includes(record.id) && state.sessionId.length > 0 && hasOwnership(state.sessionId, record.id)) {
                    owned = [...owned, record.id];
                }
                // resume：同 uid 的暂停项应在 create 后从 paused 列表消失
                const paused = state.sessionId.length > 0
                    ? pausedFromSidecar(state.sessionId)
                    : state.paused;
                // 固化创建时刻（事件 time），供客户端进度条按真实起点计算
                const withCreated = typeof event.time === 'number' ? { ...record, createdAt: event.time } : record;
                const existing = state.active.find((entry) => entry.id === record.id);
                if (existing === withCreated && owned === state.owned && paused === state.paused)
                    return state;
                return {
                    sessionId: state.sessionId,
                    owned,
                    active: existing === undefined
                        ? [...state.active, withCreated]
                        : state.active.map((entry) => (entry.id === record.id ? withCreated : entry)),
                    seedSeq: state.seedSeq,
                    paused,
                };
            }
            case 'delete': {
                if (!state.active.some((entry) => entry.id === change.id) && !state.owned.includes(change.id)) {
                    // 仍可能要把 sidecar 暂停项挂进视图（pause 刚写完留档）
                    if (state.sessionId.length > 0) {
                        const paused = pausedFromSidecar(state.sessionId);
                        const linked = findPausedByScheduleId(state.sessionId, change.id) !== undefined;
                        if (linked && paused !== state.paused) {
                            return {
                                sessionId: state.sessionId,
                                owned: state.owned.filter((id) => id !== change.id),
                                active: state.active.filter((entry) => entry.id !== change.id),
                                seedSeq: state.seedSeq,
                                paused,
                            };
                        }
                    }
                    return state;
                }
                // 删除即撤销所有权声明（sidecar 由工具路径在 flush 后清理；此处先清视图）。
                const owned = state.owned.filter((id) => id !== change.id);
                const active = state.active.filter((entry) => entry.id !== change.id);
                const paused = state.sessionId.length > 0 ? pausedFromSidecar(state.sessionId) : state.paused;
                if (owned === state.owned && active === state.active && paused === state.paused)
                    return state;
                return {
                    sessionId: state.sessionId,
                    owned,
                    active,
                    seedSeq: state.seedSeq,
                    paused,
                };
            }
            case 'dispatch': {
                const current = state.active.find((entry) => entry.id === change.id);
                if (current === undefined)
                    return state;
                let nextActive;
                if ('acceptedAt' in change) {
                    const advanced = advanceEvery(current, change.acceptedAt);
                    // 周期推进后保留 createdAt（进度条起点跨周期不变）
                    const next = advanced === undefined ? undefined : { ...advanced, createdAt: current.createdAt };
                    if (next === undefined) {
                        nextActive = state.active.filter((entry) => entry.id !== change.id);
                    }
                    else {
                        nextActive = state.active.map((entry) => (entry.id === change.id ? next : entry));
                    }
                }
                else {
                    nextActive = state.active.filter((entry) => entry.id !== change.id);
                }
                if (nextActive === state.active)
                    return state;
                return {
                    sessionId: state.sessionId,
                    owned: state.owned,
                    active: nextActive,
                    seedSeq: state.seedSeq,
                    paused: state.paused,
                };
            }
            /* c8 ignore next 2 -- decodeScheduleChange 是闭包联合 */
            default:
                return state;
        }
    }
    return state;
}
function seedIsBefore(state, event) {
    return state.seedSeq >= 0 && typeof event.seq === 'number' && event.seq < state.seedSeq;
}
/** 投影 view：活动 + 暂停（同列表；paused 靠 status 区分，dock 原地冻结）。 */
export function viewUserScheduleProjection(state) {
    const active = state.active
        .filter((record) => state.owned.includes(record.id))
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
        .map((record) => wireItemOf(record, state.sessionId));
    const paused = state.paused.map(pausedWireItemOf);
    return { schedules: [...active, ...paused] };
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
    // v3：sessionId + 所有权 sidecar；v4：paused[] 镜像（暂停/恢复）
    stateVersion: 4,
};
