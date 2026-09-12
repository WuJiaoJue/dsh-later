import type { UserScheduleDelivery } from './domain.js';
/** 单条所有权记录。 */
export interface OwnedEntry {
    /** 到点注入形态（/later 为 'user'，其余 'context'）。 */
    readonly delivery: UserScheduleDelivery;
    /** 创建时刻（epoch ms，诊断用）。 */
    readonly createdAt: number;
}
/** 读取某会话的全部所有权记录（缓存优先；返回副本语义，调用方不得变更）。 */
export declare function allOwnership(sessionId: string): Readonly<Record<string, OwnedEntry>>;
/** 某 schedule id 是否由用户工具创建。 */
export declare function hasOwnership(sessionId: string, id: string): boolean;
/** 某条所有权记录（缺失返回 undefined）。 */
export declare function getOwnership(sessionId: string, id: string): OwnedEntry | undefined;
/** 记录（新增或覆盖）一条所有权；幂等。 */
export declare function recordOwnership(sessionId: string, id: string, delivery: UserScheduleDelivery): void;
/** 撤销一条所有权；幂等（不存在时无操作）。 */
export declare function removeOwnership(sessionId: string, id: string): void;
/** 测试辅助：清空进程内缓存（不删文件）。 */
export declare function resetCacheForTests(): void;
