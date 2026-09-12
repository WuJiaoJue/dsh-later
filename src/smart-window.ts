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
export const DEFAULT_SMART_WINDOW: SmartWindowConfig = Object.freeze({
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '14:00',
  eveningEnd: '22:00',
});

/** HH:mm（24 小时制）格式。 */
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 校验一个 HH:mm 字符串。 */
export function isValidHhmm(value: unknown): value is string {
  return typeof value === 'string' && HHMM_RE.test(value);
}

/**
 * 清洗用户/配置层提供的时段字段：非法或缺省的字段逐项回落默认值
 * （host schema 与 client 设置面共用；保证下游 `nextSmartTarget` 永不因脏输入抛错）。
 */
export function sanitizeSmartWindowConfig(
  raw: Partial<Record<keyof SmartWindowConfig, unknown>> | undefined | null,
): SmartWindowConfig {
  const pick = (key: keyof SmartWindowConfig, fallback: string): string =>
    isValidHhmm(raw?.[key]) ? (raw[key] as string) : fallback;
  return {
    workStart: pick('workStart', DEFAULT_SMART_WINDOW.workStart),
    workEnd: pick('workEnd', DEFAULT_SMART_WINDOW.workEnd),
    lunchStart: pick('lunchStart', DEFAULT_SMART_WINDOW.lunchStart),
    lunchEnd: pick('lunchEnd', DEFAULT_SMART_WINDOW.lunchEnd),
    eveningEnd: pick('eveningEnd', DEFAULT_SMART_WINDOW.eveningEnd),
  };
}

/** 两次提醒之间至少等待的毫秒数（智能模式下）。 */
export const SMART_MIN_DELAY_MS = 2 * 60 * 1000;

/** 一小时/一天的毫秒数。 */
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

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
export function hhmmToMinutes(value: string): DayMinutes | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (match === null) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return hour * 60 + minute;
}

/** 把当日第几分钟格式化为 "HH:mm"。 */
export function minutesToHhmm(minutes: DayMinutes): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * 可配置时段是否有效：所有边界均为合法 HH:mm 且满足
 * workStart < lunchStart < lunchEnd < workEnd < eveningEnd。
 */
export function isValidWindow(window: SmartWindowConfig): boolean {
  const order = [
    hhmmToMinutes(window.workStart),
    hhmmToMinutes(window.lunchStart),
    hhmmToMinutes(window.lunchEnd),
    hhmmToMinutes(window.workEnd),
    hhmmToMinutes(window.eveningEnd),
  ];
  if (order.some((value) => value === undefined)) return false;
  return (
    (order[0] as number) < (order[1] as number) &&
    (order[1] as number) < (order[2] as number) &&
    (order[2] as number) < (order[3] as number) &&
    (order[3] as number) < (order[4] as number)
  );
}

/** 取整到整分钟（秒、毫秒清零）。 */
export function floorToMinute(epoch: number): number {
  return Math.floor(epoch / MINUTE_MS) * MINUTE_MS;
}

/** 为该时区构建一个 ISO 投影 formatter（含长期偏移）。 */
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

/** 把 epoch 投影到指定时区的本地日历字段。 */
export function localFieldsOf(epoch: number, timeZone: string): LocalFields {
  const formatter = formatterFor(timeZone);
  const parts = Object.fromEntries(
    formatter.formatToParts(epoch).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts['year']),
    month: Number(parts['month']),
    day: Number(parts['day']),
    hour: Number(parts['hour']),
    minute: Number(parts['minute']),
    second: Number(parts['second']),
  };
}

/** 该 epoch 在指定时区的 UTC 偏移（毫秒）：local − UTC。 */
function offsetOf(epoch: number, timeZone: string): number {
  const f = localFieldsOf(epoch, timeZone);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second, 0) - epoch;
}

/**
 * 解析一个本地墙钟时刻（hour/min 表示，sec=00）在指定时区内对应的 epoch。
 * 采用「偏移校正」法：把墙钟当 UTC 构造候选，再用采样偏移反推真实 epoch，
 * 并验证映射回原墙钟字段；DST 重叠取最早候选，缺口会导致无候选。
 */
export function resolveWallClock(
  epochOnDay: number,
  timeZone: string,
  hour: number,
  minute: number,
  second = 0,
): number | undefined {
  const base = localFieldsOf(epochOnDay, timeZone);
  const localEpoch = Date.UTC(base.year, base.month - 1, base.day, hour, minute, second, 0);
  const offsets = new Set<number>();
  for (let delta = -2; delta <= 2; delta += 1) {
    offsets.add(offsetOf(localEpoch + delta * DAY_MS, timeZone));
  }
  const candidates: number[] = [];
  for (const offset of offsets) {
    const candidate = localEpoch - offset;
    const f = localFieldsOf(candidate, timeZone);
    if (
      f.year === base.year &&
      f.month === base.month &&
      f.day === base.day &&
      f.hour === hour &&
      f.minute === minute &&
      f.second === second
    ) {
      candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a - b);
  return candidates[0];
}

/** 求「下一个严格晚于 now 的本地 HH:mm 时刻」的 epoch。 */
function nextMinutesAfter(now: number, timeZone: string, minutes: DayMinutes): number {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  let probe = resolveWallClock(now, timeZone, hour, minute);
  if (probe === undefined) {
    // DST 缺口：该墙钟时刻当天不存在，跳到次日
    probe = resolveWallClock(now + DAY_MS, timeZone, hour, minute);
  }
  if (probe === undefined) {
    // 兜底：按纯 UTC 猜测
    return Date.UTC(
      localFieldsOf(now, timeZone).year,
      localFieldsOf(now, timeZone).month - 1,
      localFieldsOf(now, timeZone).day,
      hour,
      minute,
      0,
      0,
    );
  }
  if (probe > now) return probe;
  const nextDay = resolveWallClock(probe + DAY_MS, timeZone, hour, minute) ?? probe + DAY_MS;
  return nextDay > now ? nextDay : nextDay + DAY_MS;
}

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
export function nextSmartTarget(
  now: number,
  timeZone: string,
  window: SmartWindowConfig = DEFAULT_SMART_WINDOW,
): number {
  if (!isValidWindow(window)) throw new TypeError('smart window configuration is invalid');
  const fields = localFieldsOf(now, timeZone);
  const minutes = fields.hour * 60 + fields.minute;
  const lunchStart = hhmmToMinutes(window.lunchStart) as number;
  const lunchEnd = hhmmToMinutes(window.lunchEnd) as number;
  // 午休优先：直接 now + 2 分钟
  if (minutes >= lunchStart && minutes < lunchEnd) {
    return now + SMART_MIN_DELAY_MS;
  }
  const workStart = hhmmToMinutes(window.workStart) as number;
  const eveningStart = hhmmToMinutes(window.workEnd) as number; // 工作结束 = 晚间开始
  const candidates = [
    nextMinutesAfter(now, timeZone, workStart),
    nextMinutesAfter(now, timeZone, lunchEnd),
    nextMinutesAfter(now, timeZone, eveningStart),
  ].filter((target) => target > now + SMART_MIN_DELAY_MS);
  if (candidates.length === 0) {
    const earliest = Math.min(
      nextMinutesAfter(now, timeZone, workStart),
      nextMinutesAfter(now, timeZone, lunchEnd),
      nextMinutesAfter(now, timeZone, eveningStart),
    );
    return Math.max(earliest, now + SMART_MIN_DELAY_MS);
  }
  return Math.min(...candidates);
}

/**
 * 把本地墙钟字符串（date YYYY-MM-DD、time HH:mm[:ss]）在指定时区解析为 epoch。
 * 用于自定义时间的预览与合法性校验。解析失败返回 undefined（如 DST 缺口）。
 */
export function epochFromLocal(
  date: string,
  time: string,
  timeZone: string,
): number | undefined {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (dateMatch === null || timeMatch === null) return undefined;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? '0');
  if (
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }
  // 以纯 UTC 构造「当日近似 epoch」作为锚点，再用偏移校正解析真实墙钟时刻。
  const approx = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return resolveWallClock(approx, timeZone, hour, minute, second);
}

/**
 * 智能模式的一站式目标构造：返回可直接作为 `at` 对象使用的本地日历字段。
 * @returns null 当配置非法或无法解析时。
 */
export function nextSmartAt(
  now: number,
  timeZone: string,
  window: SmartWindowConfig = DEFAULT_SMART_WINDOW,
): { date: string; time: string; time_zone: string; epoch: number } | null {
  let target: number;
  try {
    target = nextSmartTarget(now, timeZone, window);
  } catch {
    return null;
  }
  let parts: LocalFields;
  try {
    parts = localFieldsOf(target, timeZone);
  } catch {
    return null;
  }
  const date = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const time = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
  return {
    date,
    time,
    time_zone: timeZone,
    epoch: target,
  };
}
