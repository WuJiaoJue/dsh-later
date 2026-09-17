import type { UserScheduleDelivery } from './domain.js';
/** 单条所有权记录。 */
export interface OwnedEntry {
    /** 到点注入形态（/later 为 'user'，其余 'context'）。 */
    readonly delivery: UserScheduleDelivery;
    /** 创建时刻（epoch ms，诊断用）。 */
    readonly createdAt: number;
    /**
     * 稳定插件身份（跨 pause/resume/日志 id 变更）。创建时生成；
     * 旧条目可缺省（wire 回退用 scheduleId）。
     */
    readonly uid?: string;
}
/** 暂停留档（仅 kind==='after'；不进会话日志）。 */
export interface PausedEntry {
    /** 稳定身份；resume 后仍用此 uid。 */
    readonly uid: string;
    readonly prompt: string;
    readonly delivery: UserScheduleDelivery;
    readonly kind: 'after';
    /** 暂停瞬间的剩余秒数（resume 时 after_seconds）。 */
    readonly remainingSeconds: number;
    /** 原目标时刻（仅展示「原点 HH:MM」）。 */
    readonly originalScheduledAt: string;
    readonly originalAfterSeconds?: number;
    /** 暂停前的日志 schedule id（审计/关联）。 */
    readonly lastScheduleId: string;
    readonly pausedAt: number;
}
/** 读取某会话的全部所有权记录（缓存优先；返回副本语义，调用方不得变更）。 */
export declare function allOwnership(sessionId: string): Readonly<Record<string, OwnedEntry>>;
/** 某 schedule id 是否由用户工具创建。 */
export declare function hasOwnership(sessionId: string, id: string): boolean;
/** 某条所有权记录（缺失返回 undefined）。 */
export declare function getOwnership(sessionId: string, id: string): OwnedEntry | undefined;
/** 生成稳定插件 uid（pause/resume 跨日志 id 变更）。 */
export declare function newTaskUid(): string;
/** 记录（新增或覆盖）一条所有权；幂等。仅显式传入 `uid` 时写入稳定身份。 */
export declare function recordOwnership(sessionId: string, id: string, delivery: UserScheduleDelivery, uid?: string): OwnedEntry;
/** 撤销一条所有权；幂等（不存在时无操作）。 */
export declare function removeOwnership(sessionId: string, id: string): void;
/** 按 uid 找当前仍 active 的 schedule id（缺失 undefined）。 */
export declare function findScheduleIdByUid(sessionId: string, uid: string): string | undefined;
/** 全部暂停留档（uid → entry）。 */
export declare function allPaused(sessionId: string): Readonly<Record<string, PausedEntry>>;
/** 一条暂停留档。 */
export declare function getPaused(sessionId: string, uid: string): PausedEntry | undefined;
/** 按暂停前 schedule id 找留档（pause 刚写完、投影 fold 见 delete 时用）。 */
export declare function findPausedByScheduleId(sessionId: string, scheduleId: string): PausedEntry | undefined;
/** 写入/覆盖一条暂停留档。 */
export declare function recordPaused(sessionId: string, entry: PausedEntry): void;
/** 移除一条暂停留档；幂等。 */
export declare function removePaused(sessionId: string, uid: string): void;
/** 测试辅助：清空进程内缓存（不删文件）。 */
export declare function resetCacheForTests(): void;
