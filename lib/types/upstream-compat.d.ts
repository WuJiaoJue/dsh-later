/**
 * 上游内核跨代兼容层：把「鸭子类型双轨探测 + peer 代次矩阵」收敛到单文件。
 *
 * 背景（docs/verification.md）：DSH 内核 0.1.1 → 0.1.2 之间有多处不兼容，
 * 此前散落在 user-tools / index / package.json 各处。上游每发新 rc 需要：
 *   1. package.json peer + dev 各包补一枚举项（node-semver 不把预发布算进范围）
 *   2. Session API 形状若有变化，只改本模块的 read* 函数
 *
 * 新 rc 落地 checklist：
 *   - 在 KERNEL_GENERATIONS 追加一代（id + peerRange + sessionApi）
 *   - 跑 `node scripts/sync-peer-matrix.mjs` 重写 package.json peer 枚举
 *   - 跑 `npm test`（含 tests/upstream-compat.test.mjs 矩阵护栏）
 *
 * @module dsh-later/upstream-compat
 */
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
/**
 * 已验证的内核代次（peer 枚举的唯一事实来源）。
 *
 * - `id`：semver 精确版本（发布 tag）
 * - `peerRange`：写入 package.json 的范围（node-semver 预发布需显式枚举）
 * - `sessionApi`：Session 读日志的形状（见 readOwnEvents / readInheritedEventCount）
 */
export declare const KERNEL_GENERATIONS: readonly [{
    readonly id: "0.1.1-rc.2";
    readonly peerRange: "^0.1.1-rc.2";
    readonly sessionApi: "legacy-events";
}, {
    readonly id: "0.1.2-rc.1";
    readonly peerRange: "^0.1.2-rc.1";
    readonly sessionApi: "own-events";
}];
/**
 * 随内核代次一起 bump 的 peer 包（宿主 hoisting 变化会波及这些运行时 import）。
 * cordis / schemastery 等独立 semver 包**不**列入——它们不随内核 rc 枚举。
 */
export declare const KERNEL_SCOPED_PACKAGES: readonly ["@deepseek-ai/dsh-agent", "@deepseek-ai/dsh-commands", "@deepseek-ai/dsh-llm", "@deepseek-ai/dsh-schedule", "@deepseek-ai/dsh-session", "@deepseek-ai/dsh-session-projection", "@deepseek-ai/dsh-settings", "@deepseek-ai/dsh-tools"];
/** 由 KERNEL_GENERATIONS 拼出的 peer 范围串（`a || b`）。 */
export declare function peerRangeFor(packageName: string): string;
/** 全部需逐代枚举的 `{ package, range }`（sync-peer-matrix / 矩阵测试共用）。 */
export declare function peerMatrixEntries(): ReadonlyArray<{
    packageName: string;
    range: string;
}>;
/** Session 读日志的最小结构（鸭子类型；两代公有面）。 */
export interface SessionLogSurface {
    readonly header?: {
        readonly seedLength?: unknown;
    } | undefined;
    readonly events?: readonly SessionEvent[] | undefined;
    readonly ownEvents?: (() => readonly SessionEvent[]) | undefined;
    readonly inheritedEventCount?: unknown;
}
/**
 * 读取「本会话自有」事件日志（不含 fork 继承前缀时由调用方配合 offset）。
 *
 * - 0.1.2+：`session.ownEvents()`（推荐；仅 live 段）
 * - 0.1.1：`session.events`（含 seed；配合 seedLength 切片）
 */
export declare function readOwnEvents(session: SessionLogSurface | Session): readonly SessionEvent[];
/**
 * 读取「fork 继承前缀长度」——`foldScheduleEvents` 第二参数。
 *
 * - 0.1.2+：`session.inheritedEventCount`（SessionLogOffset 品牌数字，运行时仍是 number）
 * - 0.1.1：`session.header.seedLength`（等价物；此前实现漏了这条回退）
 * - 均缺失：0（新建会话 / 测试假 Session）
 *
 * 统一以裸 `number` 返回：cache key 可用 `===`；传入 foldScheduleEvents 时
 * 0.1.2 的 brandshape 校验接受 safe integer。
 */
export declare function readInheritedEventCount(session: SessionLogSurface | Session): number;
/** 探测到的 sessionApi 代次（诊断 / 测试用；不参与业务分支）。 */
export declare function detectSessionApi(session: SessionLogSurface | Session): 'own-events' | 'legacy-events';
