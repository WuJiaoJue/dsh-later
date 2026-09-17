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
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { ScheduleRecord } from '@deepseek-ai/dsh-schedule';
import type { PausedEntry } from './ownership-store.js';
import type { UserScheduleProjectionValue } from './domain.js';
/** 投影 wire 值 schema（wire.viewSchema：离开宿主前校验客户端载荷）。 */
export declare const userSchedulesSchema: z.ZodObject<{
    schedules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodUnion<readonly [z.ZodLiteral<"after">, z.ZodLiteral<"at">, z.ZodLiteral<"every">]>;
        prompt: z.ZodString;
        after_seconds: z.ZodOptional<z.ZodNumber>;
        every_seconds: z.ZodOptional<z.ZodNumber>;
        scheduled_at: z.ZodString;
        created_at: z.ZodOptional<z.ZodString>;
        delivery_mode: z.ZodLiteral<"session-local">;
        status: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"active">, z.ZodLiteral<"paused">]>>;
        remaining_seconds: z.ZodOptional<z.ZodNumber>;
        schedule_id: z.ZodOptional<z.ZodString>;
        window_seconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const userSchedulesStateSchema: z.ZodObject<{
    sessionId: z.ZodString;
    owned: z.ZodArray<z.ZodString>;
    active: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodUnion<readonly [z.ZodLiteral<"after">, z.ZodLiteral<"at">, z.ZodLiteral<"every">]>;
        prompt: z.ZodString;
        afterSeconds: z.ZodOptional<z.ZodNumber>;
        everySeconds: z.ZodOptional<z.ZodNumber>;
        scheduledAt: z.ZodString;
        createdAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
    seedSeq: z.ZodNumber;
    paused: z.ZodDefault<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        prompt: z.ZodString;
        delivery: z.ZodUnion<readonly [z.ZodLiteral<"context">, z.ZodLiteral<"user">]>;
        kind: z.ZodLiteral<"after">;
        remainingSeconds: z.ZodNumber;
        originalScheduledAt: z.ZodString;
        originalAfterSeconds: z.ZodOptional<z.ZodNumber>;
        lastScheduleId: z.ZodString;
        pausedAt: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/** 活动存储记录：dsh-schedule 记录 + 创建时刻（来自 create 事件的 time）。 */
export type StoredScheduleRecord = ScheduleRecord & {
    readonly createdAt?: number;
};
/** 投影内部状态（plain JSON：owned/active 用数组承载）。 */
export interface UserScheduleProjectionState {
    /** 会话 id（init 由 header 注入）。 */
    readonly sessionId: string;
    /** 用户工具创建的 schedule id 集合。 */
    readonly owned: readonly string[];
    /** 当前活动记录（按 schedule/change 严格 fold）。 */
    readonly active: readonly StoredScheduleRecord[];
    /** 已见 `session/end-seed` 的 seq；更早的继承前缀一律忽略。 */
    readonly seedSeq: number;
    /** sidecar 暂停留档镜像。 */
    readonly paused: readonly PausedEntry[];
}
/** 初始状态：按会话 id 从所有权 sidecar 装载（进程重启后恢复 GUI 归属）。 */
export declare function initUserScheduleProjection(header?: {
    readonly id?: string;
}): UserScheduleProjectionState;
/**
 * 增量 fold。返回同一引用当事件无关；返回新状态当 owned/active 发生变化。
 */
export declare function applyUserScheduleProjection(state: UserScheduleProjectionState, event: SessionEvent): UserScheduleProjectionState;
/** 投影 view：活动 + 暂停（同列表；paused 靠 status 区分，dock 原地冻结）。 */
export declare function viewUserScheduleProjection(state: UserScheduleProjectionState): UserScheduleProjectionValue;
/**
 * 投影单元声明（传给 sessionProjections.register）。
 *
 * 形状必须匹配 `ProjectionDefinition`：
 *  - `stateSchema`（不是 schema）：宿主持久化缓存恢复前校验内部状态；
 *  - `wire: { viewSchema, view }`（不是顶层 view）：**只有带 wire 的单元才是
 *    client-visible 的**——`snapshot()`/变更帧都会跳过无 wire 的单元，
 *    客户端 `useProjection(key)` 将永远读到 undefined。
 */
export declare const userSchedulesProjectionUnit: {
    readonly key: "userSchedules";
    readonly stateSchema: z.ZodObject<{
        sessionId: z.ZodString;
        owned: z.ZodArray<z.ZodString>;
        active: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodUnion<readonly [z.ZodLiteral<"after">, z.ZodLiteral<"at">, z.ZodLiteral<"every">]>;
            prompt: z.ZodString;
            afterSeconds: z.ZodOptional<z.ZodNumber>;
            everySeconds: z.ZodOptional<z.ZodNumber>;
            scheduledAt: z.ZodString;
            createdAt: z.ZodOptional<z.ZodNumber>;
        }, z.core.$loose>>;
        seedSeq: z.ZodNumber;
        paused: z.ZodDefault<z.ZodArray<z.ZodObject<{
            uid: z.ZodString;
            prompt: z.ZodString;
            delivery: z.ZodUnion<readonly [z.ZodLiteral<"context">, z.ZodLiteral<"user">]>;
            kind: z.ZodLiteral<"after">;
            remainingSeconds: z.ZodNumber;
            originalScheduledAt: z.ZodString;
            originalAfterSeconds: z.ZodOptional<z.ZodNumber>;
            lastScheduleId: z.ZodString;
            pausedAt: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    readonly init: typeof initUserScheduleProjection;
    readonly apply: typeof applyUserScheduleProjection;
    readonly wire: {
        readonly viewSchema: z.ZodObject<{
            schedules: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                kind: z.ZodUnion<readonly [z.ZodLiteral<"after">, z.ZodLiteral<"at">, z.ZodLiteral<"every">]>;
                prompt: z.ZodString;
                after_seconds: z.ZodOptional<z.ZodNumber>;
                every_seconds: z.ZodOptional<z.ZodNumber>;
                scheduled_at: z.ZodString;
                created_at: z.ZodOptional<z.ZodString>;
                delivery_mode: z.ZodLiteral<"session-local">;
                status: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"active">, z.ZodLiteral<"paused">]>>;
                remaining_seconds: z.ZodOptional<z.ZodNumber>;
                schedule_id: z.ZodOptional<z.ZodString>;
                window_seconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        readonly view: typeof viewUserScheduleProjection;
    };
    readonly stateVersion: 4;
};
