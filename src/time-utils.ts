/**
 * 时间格式化与通用工具（纯函数，host 与 client 共享）。
 * 文案遵循 docs/ui/08-microcopy.md 的微文案规范。
 * @module dsh-session-scheduler/time-utils
 */

/** 校验一个字符串是否为合法 IANA 时区（或 UTC）。 */
export function isValidTimeZone(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
    return resolved === value || value === 'UTC';
  } catch {
    return false;
  }
}

/** 浏览器默认时区（客户端）；host 侧无合理默认则退回 UTC。 */
export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz?.length ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 常见时区候选（面板下拉用）。 */
export const COMMON_TIME_ZONES: readonly string[] = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
];

/** 文案语言 id（zh 中文；en 英文；其余回退中文）。 */
export type TextLocale = 'zh' | 'en';

/**
 * 相对时间文案：zh "约 X 分钟后"；en "in ~X minutes" 等。
 * @param epoch - 目标 epoch 毫秒。
 * @param now - 当前 epoch 毫秒（默认 Date.now()）。
 * @param locale - 文案语言（默认 zh，host 侧无浏览器语境保持中文）。
 */
export function formatRelative(epoch: number, now: number = Date.now(), locale: TextLocale = 'zh'): string {
  const diff = epoch - now;
  if (locale === 'en') {
    if (diff < 0) return 'overdue';
    if (diff < MINUTE_MS) return 'sending soon';
    const minutes = Math.round(diff / MINUTE_MS);
    if (minutes < 60) return `in ~${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    if (hours < 24) {
      return restMinutes === 0 ? `in ~${hours} h` : `in ~${hours} h ${restMinutes} min`;
    }
    const days = Math.floor(hours / 24);
    return `in ~${days} days`;
  }
  if (diff < 0) return '已到期';
  if (diff < MINUTE_MS) return '即将发送';
  const minutes = Math.round(diff / MINUTE_MS);
  if (minutes < 60) return `约 ${minutes} 分钟后`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes === 0 ? `约 ${hours} 小时后` : `约 ${hours} 小时 ${restMinutes} 分后`;
  }
  const days = Math.floor(hours / 24);
  return `约 ${days} 天后`;
}

/** 毫秒常量（避免依赖 smart-window 再复制）。 */
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** 周几中文缩写。 */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/**
 * 完整时间文案：zh "{M}月{d}日 {周X} HH:mm"、en "Wed, Aug 26, 14:45"（按指定时区）。
 */
export function formatAbsolute(epoch: number, timeZone: string, locale: TextLocale = 'zh'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return formatter.format(epoch).replace(/\s+/g, ' ');
}

/** 仅时间部分 "HH:mm"（按指定时区）。 */
export function formatHhmm(epoch: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return formatter.format(epoch);
}

/** 周期几第几天（与 formatAbsolute 里的 wkday 词对齐）。 */
export function weekdayLabel(epoch: number, timeZone: string): string {
  const weekday = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    timeZone,
    weekday: 'short',
  }).format(epoch);
  const map: Record<string, string> = {
    Sun: '周日',
    Mon: '周一',
    Tue: '周二',
    Wed: '周三',
    Thu: '周四',
    Fri: '周五',
    Sat: '周六',
  };
  return map[weekday] ?? weekday;
}

/**
 * 倒计时 "HH:MM:SS"（或剩余不足 1 小时时 "MM:SS"）。
 */
export function formatCountdown(epoch: number, now: number = Date.now()): string {
  const remain = Math.max(0, epoch - now);
  const totalSeconds = Math.floor(remain / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** 未来距离（毫秒）；用于紧急度判断。 */
export function remainingMs(epoch: number, now: number = Date.now()): number {
  return Math.max(0, epoch - now);
}

/**
 * 构造 `at` 对象：{date, time, time_zone}。
 * @param epoch - 目标 epoch 毫秒。
 * @param timeZone - IANA 时区。
 */
export function atObjectOf(
  epoch: number,
  timeZone: string,
): { date: string; time: string; time_zone: string } {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(epoch);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return {
    date: `${map['year']}-${map['month']}-${map['day']}`,
    time: `${map['hour']}:${map['minute']}:${map['second']}`,
    time_zone: timeZone,
  };
}
