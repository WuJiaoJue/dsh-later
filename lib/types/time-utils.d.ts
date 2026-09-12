/**
 * 时间格式化与通用工具（纯函数，host 与 client 共享）。
 * 文案遵循 docs/ui/08-microcopy.md 的微文案规范。
 * @module dsh-later/time-utils
 */
/** 校验一个字符串是否为合法 IANA 时区（或 UTC）。 */
export declare function isValidTimeZone(value: string): boolean;
/** 浏览器默认时区（客户端）；host 侧无合理默认则退回 UTC。 */
export declare function detectTimeZone(): string;
/** 常见时区候选（面板下拉用）。 */
export declare const COMMON_TIME_ZONES: readonly string[];
/** 文案语言 id（zh 中文；en 英文；其余回退中文）。 */
export type TextLocale = 'zh' | 'en';
/**
 * 相对时间文案：zh "约 X 分钟后"；en "in ~X minutes" 等。
 * @param epoch - 目标 epoch 毫秒。
 * @param now - 当前 epoch 毫秒（默认 Date.now()）。
 * @param locale - 文案语言（默认 zh，host 侧无浏览器语境保持中文）。
 */
export declare function formatRelative(epoch: number, now?: number, locale?: TextLocale): string;
/** 毫秒常量（避免依赖 smart-window 再复制）。 */
export declare const MINUTE_MS: number;
export declare const HOUR_MS: number;
export declare const DAY_MS: number;
/**
 * 完整时间文案：zh "{M}月{d}日 {周X} HH:mm"、en "Wed, Aug 26, 14:45"（按指定时区）。
 */
export declare function formatAbsolute(epoch: number, timeZone: string, locale?: TextLocale): string;
/** 仅时间部分 "HH:mm"（按指定时区）。 */
export declare function formatHhmm(epoch: number, timeZone: string): string;
/** 周期几第几天（与 formatAbsolute 里的 wkday 词对齐）。 */
export declare function weekdayLabel(epoch: number, timeZone: string): string;
/**
 * 倒计时 "HH:MM:SS"（或剩余不足 1 小时时 "MM:SS"）。
 */
export declare function formatCountdown(epoch: number, now?: number): string;
/** 未来距离（毫秒）；用于紧急度判断。 */
export declare function remainingMs(epoch: number, now?: number): number;
/**
 * 构造 `at` 对象：{date, time, time_zone}。
 * @param epoch - 目标 epoch 毫秒。
 * @param timeZone - IANA 时区。
 */
export declare function atObjectOf(epoch: number, timeZone: string): {
    date: string;
    time: string;
    time_zone: string;
};
