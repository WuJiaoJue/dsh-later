/**
 * 用户工具核心实现：`user_schedule_create` / `user_schedule_list` /
 * `user_schedule_delete`。
 *
 * 复用 dsh-schedule 导出的领域函数（fold / allocate / 各 create 函数 /
 * scheduleView），写入**完全兼容**的 `schedule/change` 事件（不携带 `source`
 * 字段，避免破坏 dsh-schedule 严格解码）。
 *
 * 用户来源（所有权 + 投递形态）记录在**插件自己的 sidecar 文件**里
 * （ownership-store.ts），**不再写入会话日志**——2026-09 根治：伴生事件
 * `session-scheduler/user-schedule` 曾因宿主持久化静默丢行而留下永久 seq
 * 缺口，让整份历史被拒读。日志里若仍残留旧的伴生事件（历史日志），fold
 * 会继续读取（读兼容），但本模块不再产生它们。
 *
 * 所有读改写操作按 agent 串行化（同 dsh-schedule 的 agent-scoped 队列），
 * 保证 id 分配与 fold 不会并发竞争。
 * @module dsh-later/user-tools
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import { foldScheduleEvents } from '@deepseek-ai/dsh-schedule';
import type { ScheduleRecord, ScheduleView } from '@deepseek-ai/dsh-schedule';
import type { UserScheduleDelivery } from './domain.js';
/** 单 session 用户任务上限（PRD：防滥用）。 */
export declare const DEFAULT_MAX_SCHEDULES = 100;
/**
 * 经过 trim 后允许的默认最大提示字符数（P0：注入防护的保守下限）。
 *
 * 当 settings 中 `allowLongPrompts=false` 时此值始终生效；为 `true` 时
 * 由 `maxPromptChars` 字段接管实际字符上限。用户必须显式 opt-in 才解除
 * 该硬上限——保持默认安全的姿态。
 */
export declare const DEFAULT_MAX_PROMPT_CHARS = 1000;
/** 用户工具的提示字符上限策略（来自插件 settings）。 */
export interface PromptLimits {
    /** 是否解除 `DEFAULT_MAX_PROMPT_CHARS` 硬上限；未开启时 maxChars 始终等于默认值。 */
    readonly allowLong: boolean;
    /** 当前允许的最大字符数（已根据 allowLong 解析过）。 */
    readonly maxChars: number;
}
/**
 * 从 settings 解析出实际生效的 PromptLimits。
 * 容错非法值（NaN / 负数 / 非数）回落 DEFAULT_MAX_PROMPT_CHARS。
 */
export declare function resolvePromptLimits(settings: {
    readonly allowLongPrompts?: boolean;
    readonly maxPromptChars?: number;
} | undefined): PromptLimits;
/** 单条提示的字符校验（纯函数）。返回 trim 后的字符串或闭包错误。 */
export declare function validatePrompt(raw: unknown, limits: PromptLimits): {
    ok: true;
    value: string;
} | UserScheduleError;
/** 用户工具稳定的闭包错误集合（在 dsh-schedule 闭包之上追加本插件专用码）。 */
export type UserScheduleErrorCode = 'invalid_prompt' | 'invalid_selector' | 'invalid_time_zone' | 'not_future' | 'time_out_of_range' | 'frequency_too_high' | 'invalid_rule' | 'schedule_not_found' | 'already_overdue' | 'quota_exceeded' | 'persistence_uncertain' | 'internal_error';
/** 封闭错误值。 */
export interface UserScheduleError {
    readonly ok: false;
    readonly code: UserScheduleErrorCode;
    readonly message: string;
}
/** 成功值。 */
export type UserScheduleResult<TSuccess> = TSuccess | UserScheduleError;
/** `user_schedule_create` 成功响应。 */
export type UserScheduleCreateResult = UserScheduleResult<ScheduleRecordView & {
    readonly ok: true;
}>;
/** `user_schedule_list` 成功响应。 */
export type UserScheduleListResult = UserScheduleResult<{
    readonly ok: true;
    readonly schedules: readonly ScheduleRecordView[];
}>;
/** `user_schedule_delete` 成功响应。 */
export type UserScheduleDeleteResult = UserScheduleResult<{
    readonly ok: true;
    readonly id: string;
    readonly deleted: true;
} | {
    readonly ok: true;
    readonly id: string;
    readonly deleted: false;
    readonly code: 'schedule_not_found';
}>;
/** `user_schedule_create` 的规范化输入。 */
export interface UserScheduleCreateInput {
    readonly prompt: string;
    readonly time_zone: string;
    readonly after_seconds?: number;
    readonly at?: string | {
        readonly date: string;
        readonly time: string;
        readonly time_zone: string;
    };
    readonly every_seconds?: number;
}
/** 校验 `user_schedule_create` 参数（纯函数，含 TRIM 非空、长度、三选一）。
 *
 * `limits` 可选：未传时回落到 `DEFAULT_MAX_PROMPT_CHARS`（保持向后兼容）；
 * 命令与工具的注册路径会按当前 settings 传入实际 limits，校验消息会反映
 * 当前生效的字符上限（与模型可见的 tool description 同步）。
 */
export declare function validateCreateInput(input: unknown, limits?: PromptLimits): {
    ok: true;
    value: UserScheduleCreateInput;
} | UserScheduleError;
/** 校验 IANA 时区（与 dsh-schedule canonicalize 同源，容错）。 */
export declare function isValidIanaZone(value: string): boolean;
/** 从会话日志导出「用户创建过的 schedule id 集合」（历史遗留读兼容）。 */
export declare function foldOwnedIds(events: readonly SessionEvent[]): Set<string>;
/**
 * 从会话日志导出「schedule id → 到点注入形态」映射（默认 `context`）。
 * 供 runtime 在 dispatch 时按 `/later` 与 `/schedule` 分别注入。
 */
export declare function foldOwnedDelivery(events: readonly SessionEvent[]): ReadonlyMap<string, UserScheduleDelivery>;
/**
 * 会话级 fold 缓存（P1-6）：事件日志只增不改（事件溯源），
 * 按「数组身份 + 长度」判定命中——append 原地 push 使长度变化即失效；
 * 整体换数组则身份不同也失效。两种实现风格下都安全。
 *
 * 消除热路径（每次 drive / 每次工具调用）对全量日志的重复 O(n) 扫描。
 */
export interface UserFoldState {
    readonly folded: ReturnType<typeof foldScheduleEvents>;
    readonly owned: ReadonlySet<string>;
    readonly delivery: ReadonlyMap<string, UserScheduleDelivery>;
}
/** fold 当前会话的完整用户调度状态（带缓存；调用方不得变更返回值）。
 *
 * 跨代 Session API 探测已收敛到 `upstream-compat.ts`（readOwnEvents /
 * readInheritedEventCount）——新 rc 若再改名只动那一处。
 */
export declare function foldUserState(session: Session): UserFoldState;
/** 稳定内部错误（不透出异常细节）。 */
export declare function internalError(): UserScheduleError;
/** 稳定持久化不确定错误。 */
export declare function persistenceError(): UserScheduleError;
/** 把 dsh-schedule 的 ScheduleInputError 翻译为闭包错误值。 */
export declare function toInputError(error: unknown): UserScheduleError;
/** 记录视图的 snake_case 序列化。 */
export type ScheduleRecordView = {
    readonly id: string;
    readonly kind: ScheduleRecord['kind'];
    readonly prompt: string;
    readonly after_seconds?: number;
    readonly every_seconds?: number;
    readonly scheduled_at: string;
    readonly state: 'scheduled' | 'overdue';
    readonly delivery_mode: 'session-local';
    readonly source: 'user-tool';
};
/** 把 dsh-schedule 的 view 序列化为 snake_case 记录。 */
export declare function serializeScheduleView(view: ScheduleView): ScheduleRecordView;
/** 在当前 agent 的事务尾之后运行操作。 */
export declare function runUserScheduleTransaction<T>(agent: Agent, operation: () => Promise<T>): Promise<T>;
/**
 * `user_schedule_create` 的可信通道选项。
 *
 * 安全边界（P0-1）：`delivery:'user'`（到点以用户身份代发，绕过注入防护）只能
 * 由人类显式输入的 `/later` 命令经 `trustedDelivery` **显式声明**——原始输入里的
 * 同名字段一律被忽略。模型工具与 GUI 面板通道不传该选项，永远得到安全的
 * `context` 注入形态；即使模型在工具参数里夹带 `delivery:'user'` 也无效。
 */
export interface UserScheduleCreateOptions {
    /** 可信通道显式声明的投递形态；未提供或非 'user' 一律按安全默认 'context'。 */
    readonly trustedDelivery?: UserScheduleDelivery;
}
/** `user_schedule_create` 核心实现。 */
export declare function userScheduleCreate(input: unknown, agent: Agent, ctx: Context, maxSchedules?: number, options?: UserScheduleCreateOptions, limits?: PromptLimits): Promise<UserScheduleCreateResult>;
/** `user_schedule_list` 核心实现。 */
export declare function userScheduleList(agent: Agent, ctx: Context): Promise<UserScheduleListResult>;
/** `user_schedule_delete` 核心实现。 */
export declare function userScheduleDelete(id: unknown, agent: Agent, ctx: Context): Promise<UserScheduleDeleteResult>;
/** `user_schedule_edit`（改内容）核心实现：删旧建新，保留原时刻与 delivery。 */
export declare function userScheduleEditPrompt(id: unknown, newPrompt: unknown, agent: Agent, ctx: Context, limits?: PromptLimits): Promise<UserScheduleCreateResult | UserScheduleError>;
