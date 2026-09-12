/**
 * 智能时段计算（纯函数，host 与 client 共享）。
 *
 * 默认时段（v1 硬编码，可经 cordis config 覆盖）：
 *   工作时间 09:00–18:00
 *   午休时间 12:00–14:00
 *   晚间时间 18:00–22:00
 *   夜间静默 22:00–次日 09:00（不发送）
 *
 * 计算在**用户显式选定的 IANA 时区**内进行（不自动推断，确定性优先）。
 * 墙钟→epoch 的解析采用 dsh-schedule `resolveLocalInstant` 同款偏移校正法，
 * 避免依赖进程时区。
 * @module dsh-later/smart-window
 */
/** 智能时段配置（HH:mm 格式，可配置）。 */
export interface SmartWindowConfig {
    /** 工作时间开始。 */
    readonly workStart: string;
    /** 工作时间结束。 */
    readonly workEnd: string;
    /** 午休开始。 */
    readonly lunchStart: string;
    /** 午休结束。 */
    readonly lunchEnd: string;
    /** 晚间结束（夜间静默起点）。 */
    readonly eveningEnd: string;
}
/** 默认时段。 */
export declare const DEFAULT_SMART_WINDOW: SmartWindowConfig;
/** 校验一个 HH:mm 字符串。 */
export declare function isValidHhmm(value: unknown): value is string;
/**
 * 清洗用户/配置层提供的时段字段：非法或缺省的字段逐项回落默认值
 * （host schema 与 client 设置面共用；保证下游 `nextSmartTarget` 永不因脏输入抛错）。
 */
export declare function sanitizeSmartWindowConfig(raw: Partial<Record<keyof SmartWindowConfig, unknown>> | undefined | null): SmartWindowConfig;
/** 两次提醒之间至少等待的毫秒数（智能模式下）。 */
export declare const SMART_MIN_DELAY_MS: number;
/** 一小时/一天的毫秒数。 */
export declare const MINUTE_MS: number;
export declare const HOUR_MS: number;
export declare const DAY_MS: number;
/** 当日第几分钟（0–1439）。 */
export type DayMinutes = number;
/** 本地日历字段。 */
export interface LocalFields {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
}
/**
 * 把 "HH:mm" 解析为当日第几分钟；非法返回 undefined。
 */
export declare function hhmmToMinutes(value: string): DayMinutes | undefined;
/** 把当日第几分钟格式化为 "HH:mm"。 */
export declare function minutesToHhmm(minutes: DayMinutes): string;
/**
 * 可配置时段是否有效：所有边界均为合法 HH:mm 且满足
 * workStart < lunchStart < lunchEnd < workEnd < eveningEnd。
 */
export declare function isValidWindow(window: SmartWindowConfig): boolean;
/** 取整到整分钟（秒、毫秒清零）。 */
export declare function floorToMinute(epoch: number): number;
/** 把 epoch 投影到指定时区的本地日历字段。 */
export declare function localFieldsOf(epoch: number, timeZone: string): LocalFields;
/**
 * 解析一个本地墙钟时刻（hour/min 表示，sec=00）在指定时区内对应的 epoch。
 * 采用「偏移校正」法：把墙钟当 UTC 构造候选，再用采样偏移反推真实 epoch，
 * 并验证映射回原墙钟字段；DST 重叠取最早候选，缺口会导致无候选。
 */
export declare function resolveWallClock(epochOnDay: number, timeZone: string, hour: number, minute: number, second?: number): number | undefined;
/**
 * 计算下一个智能时段的本地墙钟目标。
 *
 * 规则：
 *  - 若当前在午休时段（lunchStart ≤ now < lunchEnd）→ 目标为 now + 2 分钟；
 *  - 否则候选为下一个 工作开始 / 午休结束 / 晚间开始（均 > now + 2 分钟），取最早者；
 *  - 夜间静默（≥ eveningEnd 或 < workStart）自然被「下一个工作开始」覆盖。
 *
 * @param now - 当前墙钟 epoch 毫秒。
 * @param timeZone - 用户显式选定的 IANA 时区。
 * @param window - 时段配置（默认 {@link DEFAULT_SMART_WINDOW}）。
 * @returns 目标 epoch 毫秒（严格位于未来，且至少 SMART_MIN_DELAY_MS 之后）。
 */
export declare function nextSmartTarget(now: number, timeZone: string, window?: SmartWindowConfig): number;
/**
 * 把本地墙钟字符串（date YYYY-MM-DD、time HH:mm[:ss]）在指定时区解析为 epoch。
 * 用于自定义时间的预览与合法性校验。解析失败返回 undefined（如 DST 缺口）。
 */
export declare function epochFromLocal(date: string, time: string, timeZone: string): number | undefined;
/**
 * 智能模式的一站式目标构造：返回可直接作为 `at` 对象使用的本地日历字段。
 * @returns null 当配置非法或无法解析时。
 */
export declare function nextSmartAt(now: number, timeZone: string, window?: SmartWindowConfig): {
    date: string;
    time: string;
    time_zone: string;
    epoch: number;
} | null;
