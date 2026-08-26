/**
 * 客户端 → host 变更通道：通过 DSH 的 slash-command 一等机制把 GUI 的
 * 创建/删除/列表请求送到宿主，由 handler 复用 `user-tools` 一次性写入会话日志。
 *
 * 为什么不用 Typert Remote：命令 handler 直接携带 `agent`，天然按会话路由，
 * 且 `command/run` / `command/done` 自动落日志（审计友好）。`recordInput: false`
 * 避免把 GUI 的 JSON 载荷重复写进日志（权威载荷在 domain 事件里）。
 *
 * 客户端经 `session.command('/user-schedule-create <json>')` 调用；
 * 返回的 `RemoteResult<{matched}>` 只表达“已受理”，状态以 `userSchedules`
 * 投影回流（commands 框架本身的 admission 语义）。
 * @module dsh-session-scheduler/commands
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CommandDefinition, CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import {
  userScheduleCreate,
  userScheduleDelete,
  userScheduleEditPrompt,
  userScheduleList,
} from './user-tools.js';
import { DEFAULT_MAX_SCHEDULES } from './user-tools.js';
import { epochFromLocal, localFieldsOf } from './smart-window.js';
import { detectTimeZone, formatAbsolute, formatRelative } from './time-utils.js';

/** 用户创建/删除成功后的通知回调（宿主用它重驱用户调度器）。 */
export type UserChangeNotifier = (agent: Agent) => void;

/** 命令名前缀（避免与其他插件命令冲突）。 */
const PREFIX = 'user-schedule';

/** 把任意异常稳定渲染为命令错误文本。 */
function renderError(message: string): CommandResult {
  return { kind: 'error', text: message };
}

/** 解析 JSON 载荷；非法返回错误描述。 */
function parsePayload(rawInput: string): { ok: true; value: unknown } | { ok: false; text: string } {
  const text = rawInput.trim();
  if (text.length === 0) return { ok: false, text: '缺少 JSON 载荷。' };
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, text: 'JSON 载荷必须是一个对象。' };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, text: 'JSON 载荷解析失败。' };
  }
}

/** `parseScheduleSpec` 的结果。 */
export type ParsedScheduleSpec =
  | { ok: true; kind: 'after'; afterSeconds: number }
  | { ok: true; kind: 'at'; at: { date: string; time: string; time_zone: string }; epoch: number }
  | { ok: false; error: string };

/** `parseScheduleInput` 的结果：时间目标 + 剩余内容。 */
export type ParsedScheduleInput =
  | {
      ok: true;
      target:
        | { kind: 'after'; afterSeconds: number }
        | { kind: 'at'; at: { date: string; time: string; time_zone: string }; epoch: number };
      content: string;
    }
  | { ok: false; error: string };

/** 中文数字 → 数值（支持 十/两/半 由调用方特判）。 */
const CN_DIGIT: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function cnToNumber(text: string): number | undefined {
  if (/^\d+$/.test(text)) return Number(text);
  const tenIdx = text.indexOf('十');
  if (tenIdx >= 0) {
    const head = text.slice(0, tenIdx);
    const tail = text.slice(tenIdx + 1);
    const headVal = head === '' ? 1 : CN_DIGIT[head];
    if (headVal === undefined) return undefined;
    let total = headVal * 10;
    if (tail !== '') {
      const tailVal = CN_DIGIT[tail];
      if (tailVal === undefined) return undefined;
      total += tailVal;
    }
    return total;
  }
  let total = 0;
  for (const ch of text) {
    const d = CN_DIGIT[ch];
    if (d === undefined) return undefined;
    total = total * 10 + d;
  }
  return total;
}

/** 归一化：全角冒号/数字 → 半角，压缩空白。 */
function normalizeInput(raw: string): string {
  return raw
    .replace(/[：]/g, ':')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim();
}

/** 相对时长的中文单位秒数。 */
const CN_UNIT_SECONDS: Record<string, number> = {
  秒: 1, 秒钟: 1, 分: 60, 分钟: 60, 小时: 3600, 个小时: 3600, 钟头: 3600, 天: 86400, 日: 86400, 周: 604800,
};

/** 内部匹配结果。 */
interface TargetMatch {
  consumed: number;
  target:
    | { kind: 'after'; afterSeconds: number }
    | { kind: 'at'; date?: string; month?: number; day?: number; year?: number; dayOffset?: number; hour: number; minute: number };
}

/** 在归一化文本开头尝试匹配一个时间表达式；失败返回 undefined。 */
function matchTimeExpr(s: string): TargetMatch | undefined {
  // 1. 拉丁相对时长：+30m / +1h30m / +90s / +1w（后面可跟内容）
  const latinRel = /^\+\s*((?:\d+\s*(?:s|m|h|d|w)\s*)+)(?![0-9a-z])/i.exec(s);
  if (latinRel !== null) {
    let total = 0;
    const unitRe = /(\d+)\s*(s|m|h|d|w)/gi;
    for (const match of (latinRel[1] ?? '').matchAll(unitRe)) {
      const n = Number(match[1]);
      const u = (match[2] ?? 'm').toLowerCase();
      total += n * (u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : u === 'd' ? 86400 : 604800);
    }
    if (total <= 0) return undefined;
    return { consumed: latinRel[0].length, target: { kind: 'after', afterSeconds: total } };
  }

  // 2. 中文相对时长：30分钟后 / 半小时后 / 两小时后 / 1天以后
  const cnRel = /^(半|\d+|[零一二两三四五六七八九十]+)\s*(个\s*小时|秒钟?|分钟?|小时|钟头|天|日|周)\s*(?:之)?后?/.exec(s);
  if (cnRel !== null) {
    const value = cnRel[1] === '半' ? 0.5 : cnToNumber(cnRel[1] ?? '');
    const unitKey = (cnRel[2] ?? '').replace(/\s+/g, '');
    const unitSeconds = CN_UNIT_SECONDS[unitKey];
    if (value === undefined || value <= 0 || unitSeconds === undefined) return undefined;
    return {
      consumed: cnRel[0].length,
      target: { kind: 'after', afterSeconds: Math.round(value * unitSeconds) },
    };
  }

  // 3. 紧凑日期：YYYYMMDD-HHMM / MMDD-HHMM（显式日期，不自动顺延）
  const compactFull = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(?!\d)/.exec(s);
  if (compactFull !== null) {
    return {
      consumed: compactFull[0].length,
      target: {
        kind: 'at',
        year: Number(compactFull[1]), month: Number(compactFull[2]), day: Number(compactFull[3]),
        hour: Number(compactFull[4]), minute: Number(compactFull[5]),
      },
    };
  }
  const compactShort = /^(\d{2})(\d{2})-(\d{2})(\d{2})(?!\d)/.exec(s);
  if (compactShort !== null) {
    return {
      consumed: compactShort[0].length,
      target: {
        kind: 'at',
        month: Number(compactShort[1]), day: Number(compactShort[2]),
        hour: Number(compactShort[3]), minute: Number(compactShort[4]),
      },
    };
  }

  // 4. 通用组合：[今天|明天|后天|大后天] [日期] 时刻
  let i = 0;
  let dayOffset: number | undefined;
  const dayWords: readonly (readonly [string, number])[] = [['大后天', 3], ['后天', 2], ['明天', 1], ['明日', 1], ['今天', 0], ['今日', 0]];
  for (const [word, offset] of dayWords) {
    if (s.startsWith(word)) {
      dayOffset = offset;
      i += word.length;
      break;
    }
  }
  while (s[i] === ' ') i += 1;

  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  const rest1 = s.slice(i);
  const fullDate = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日号]?/.exec(rest1);
  if (fullDate !== null) {
    year = Number(fullDate[1]);
    month = Number(fullDate[2]);
    day = Number(fullDate[3]);
    i += fullDate[0].length;
  } else {
    const shortDate = /^(\d{1,2})[月/-](\d{1,2})[日号]?/.exec(rest1);
    if (shortDate !== null && (shortDate[0].includes('月') || shortDate[0].includes('-') || shortDate[0].includes('/'))) {
      month = Number(shortDate[1]);
      day = Number(shortDate[2]);
      i += shortDate[0].length;
    }
  }
  while (s[i] === ' ') i += 1;

  // 时刻：15:32 / 15时32分 / 9点 / 9点半 / 9点整
  const rest2 = s.slice(i);
  let hour: number | undefined;
  let minute = 0;
  let timeLen = 0;
  const colonTime = /^(\d{1,2}):(\d{2})/.exec(rest2);
  const cnTime = /^(\d{1,2}|[零一二两三四五六七八九十]+)\s*[点时]\s*(?:(半|\d{1,2}|[一二三四五]+)\s*分?)?\s*整?/.exec(rest2);
  if (colonTime !== null) {
    hour = Number(colonTime[1]);
    minute = Number(colonTime[2]);
    timeLen = colonTime[0].length;
  } else if (cnTime !== null) {
    const h = cnToNumber(cnTime[1] ?? '');
    if (h === undefined) return undefined;
    hour = h;
    const minRaw = cnTime[2];
    if (minRaw !== undefined) {
      minute = minRaw === '半' ? 30 : (cnToNumber(minRaw) ?? -1);
      if (minute < 0) return undefined;
    }
    timeLen = cnTime[0].length;
  } else if (dayOffset === undefined && year === undefined && month === undefined) {
    // 裸 HHMM（仅当无任何日期成分；后面必须是空白或结尾）
    const bare = /^(\d{2})(\d{2})(?!\d)(?=\s|$)/.exec(rest2);
    if (bare !== null) {
      hour = Number(bare[1]);
      minute = Number(bare[2]);
      timeLen = bare[0].length;
    }
  }
  if (hour === undefined) return undefined;
  i += timeLen;

  return {
    consumed: i,
    target: {
      kind: 'at', hour, minute,
      ...(year !== undefined ? { year } : {}),
      ...(month !== undefined ? { month } : {}),
      ...(day !== undefined ? { day } : {}),
      ...(dayOffset !== undefined ? { dayOffset } : {}),
    },
  };
}

/** 目标解析结果（时间 → 具体时刻/时长的落定）。 */
type ResolvedTarget =
  | { kind: 'after'; afterSeconds: number }
  | { kind: 'at'; at: { date: string; time: string; time_zone: string }; epoch: number };
type TargetResolution =
  | { status: 'ok'; target: ResolvedTarget }
  | { status: 'error'; error: string };

/** 把 matchTimeExpr 的原始匹配落定为具体目标（含日期推算与越界校验）。 */
function resolveTarget(matched: TargetMatch, now: number, timeZone: string): TargetResolution {
  const t = matched.target;
  if (t.kind === 'after') {
    return { status: 'ok', target: { kind: 'after', afterSeconds: t.afterSeconds } };
  }

  // 范围校验
  if ((t.month !== undefined && (t.month < 1 || t.month > 12)) ||
      (t.day !== undefined && (t.day < 1 || t.day > 31)) ||
      t.hour > 23 || t.minute > 59) {
    return { status: 'error', error: '日期或时间数值无效。' };
  }

  const hhmm = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  const epochOf = (date: string): number | undefined => {
    const e = epochFromLocal(date, `${hhmm}:00`, timeZone);
    return e === undefined || Number.isNaN(e) ? undefined : e;
  };
  const atOk = (date: string): TargetResolution => ({
    status: 'ok',
    target: { kind: 'at', at: { date, time: `${hhmm}:00`, time_zone: timeZone }, epoch: epochOf(date) as number },
  });

  // 显式完整日期（含年）
  if (t.year !== undefined && t.month !== undefined && t.day !== undefined) {
    const date = `${String(t.year).padStart(4, '0')}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
    if (epochOf(date) === undefined) return { status: 'error', error: '日期不存在。' };
    if ((epochOf(date) as number) <= now) return { status: 'error', error: '目标时间已过去。' };
    return atOk(date);
  }

  // 显式月日（今年，已过则明年）
  if (t.month !== undefined && t.day !== undefined) {
    const thisYear = localFieldsOf(now, timeZone).year;
    for (const y of [thisYear, thisYear + 1]) {
      const date = `${y}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
      const epoch = epochOf(date);
      if (epoch !== undefined && epoch > now) return atOk(date);
    }
    return { status: 'error', error: '目标时间已过去。' };
  }

  // 今天/明天/后天/大后天（显式指定，不自动顺延）
  if (t.dayOffset !== undefined) {
    const f = localFieldsOf(now + t.dayOffset * 24 * 3600 * 1000, timeZone);
    const date = `${f.year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
    const epoch = epochOf(date);
    if (epoch === undefined) return { status: 'error', error: '无法解析目标时间。' };
    if (epoch <= now) return { status: 'error', error: '该时刻今天已过去，可改用「明天」或具体日期。' };
    return atOk(date);
  }

  // 仅时刻：从今天起顺延，最多 7 天
  for (let add = 0; add < 8; add += 1) {
    const f = localFieldsOf(now + add * 24 * 3600 * 1000, timeZone);
    const date = `${f.year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
    const epoch = epochOf(date);
    if (epoch !== undefined && epoch > now) return atOk(date);
  }
  return { status: 'error', error: '无法解析目标时间。' };
}

/**
 * 解析 `/schedule` 的完整输入：开头的时间表达式 + 剩余内容。
 *
 * 支持格式（示例）：
 *  - `+30m` `+1h30m` `+90s` `+1w`
 *  - `30分钟后` `半小时后` `两小时后` `1天以后`
 *  - `1532` `15:32` `15：32` `15时32分` `9点` `9点半`
 *  - `明天 15:32` `后天9点` `大后天 10:00`
 *  - `8月21日 15:32` `08-21 15:32`
 *  - `2026-08-21 15:32` `0821-1532` `20260821-1532`
 */
export function parseScheduleInput(raw: string, now: number, timeZone: string): ParsedScheduleInput {
  const s = normalizeInput(raw);
  if (s.length === 0) return { ok: false, error: '用法：/schedule <时间> <内容>，如 /schedule 1532 检查构建结果' };

  const matched = matchTimeExpr(s);
  if (matched === undefined) {
    return { ok: false, error: '无法识别的时间格式。支持：+30m、1532、15:32、30分钟后、明天9点、8月21日 15:32、2026-08-21 15:32 等。' };
  }
  const resolved = resolveTarget(matched, now, timeZone);
  if (resolved.status === 'error') return { ok: false, error: resolved.error };

  const content = s.slice(matched.consumed).trim();
  if (content.length === 0) return { ok: false, error: '提醒内容不能为空。' };
  if (content.length > 1000) return { ok: false, error: '提醒内容不能超过 1000 字符。' };

  return { ok: true, target: resolved.target, content };
}

/**
 * 兼容旧签名：解析纯时间描述（不含内容）。
 */
export function parseScheduleSpec(spec: string, now: number, timeZone: string): ParsedScheduleSpec {
  const s = normalizeInput(spec);
  const matched = matchTimeExpr(s);
  if (matched === undefined) {
    return { ok: false, error: '无法识别的时间格式。支持：+30m、1532、15:32、30分钟后、明天9点 等。' };
  }
  const resolved = resolveTarget(matched, now, timeZone);
  if (resolved.status === 'error') return { ok: false, error: resolved.error };
  if (s.slice(matched.consumed).trim().length > 0) {
    return { ok: false, error: '无法识别的时间格式。支持：+30m、1532、15:32、30分钟后、明天9点 等。' };
  }
  if (resolved.target.kind === 'after') {
    return { ok: true, kind: 'after', afterSeconds: resolved.target.afterSeconds };
  }
  return { ok: true, kind: 'at', at: resolved.target.at, epoch: resolved.target.epoch };
}

/** 命令工厂：返回三个命令定义。 */
export function userScheduleCommands(
  ctx: Context,
  maxSchedules: number = DEFAULT_MAX_SCHEDULES,
  onUserChange?: UserChangeNotifier,
): CommandDefinition[] {
  const create: CommandDefinition = {
    name: `${PREFIX}-create`,
    description: '创建一条会话内定时提醒（GUI 内部通道）。',
    recordInput: false,
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const parsed = parsePayload(invocation.rawInput);
      if (!parsed.ok) return renderError(parsed.text);
      const result = await userScheduleCreate(parsed.value, invocation.agent, ctx, maxSchedules);
      if (!result.ok) {
        return { kind: 'error', text: `${result.code}: ${result.message}` };
      }
      try {
        onUserChange?.(invocation.agent);
      } catch {
        /* 通知失败不影响命令成功结果 */
      }
      return { kind: 'success', text: JSON.stringify({ ...result }) };
    },
  };

  const list: CommandDefinition = {
    name: `${PREFIX}-list`,
    description: '列出当前会话用户创建的定时提醒（GUI 内部通道）。',
    recordInput: false,
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const result = await userScheduleList(invocation.agent, ctx);
      if (!result.ok) {
        return { kind: 'error', text: `${result.code}: ${result.message}` };
      }
      return { kind: 'success', text: JSON.stringify(result.schedules) };
    },
  };

  const del: CommandDefinition = {
    name: `${PREFIX}-delete`,
    description: '删除一条会话内定时提醒（GUI 内部通道）。',
    recordInput: false,
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const parsed = parsePayload(invocation.rawInput);
      if (!parsed.ok) return renderError(parsed.text);
      const id = (parsed.value as Record<string, unknown>)['id'];
      const result = await userScheduleDelete(id, invocation.agent, ctx);
      if (!result.ok) {
        return { kind: 'error', text: `${result.code}: ${result.message}` };
      }
      if (result.deleted) {
        try {
          onUserChange?.(invocation.agent);
        } catch {
          /* 通知失败不影响命令成功结果 */
        }
      }
      return { kind: 'success', text: JSON.stringify({ id: result.id, deleted: result.deleted }) };
    },
  };

  const edit: CommandDefinition = {
    name: `${PREFIX}-edit`,
    description: '修改一条会话内定时提醒的内容（保留原时刻；GUI 内部通道）。',
    recordInput: false,
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const parsed = parsePayload(invocation.rawInput);
      if (!parsed.ok) return renderError(parsed.text);
      const value = parsed.value as Record<string, unknown>;
      const result = await userScheduleEditPrompt(value['id'], value['prompt'], invocation.agent, ctx);
      if (!result.ok) {
        return { kind: 'error', text: `${result.code}: ${result.message}` };
      }
      try {
        onUserChange?.(invocation.agent);
      } catch {
        /* 通知失败不影响命令成功结果 */
      }
      return { kind: 'success', text: JSON.stringify(result) };
    },
  };

  // 人类友好快捷命令：/schedule <时间> <内容>（到点以「上下文注入」提醒注入）与
  // /later <时间> <内容>（到点以「我」的身份发送 = 延迟发送语义，产品取舍见
  // 下方注释）。两者共享同一解析与创建逻辑，仅 delivery 不同。
  const buildQuickHandler = (delivery: 'context' | 'user') => {
    return async (invocation: CommandInvocation): Promise<CommandResult> => {
      const timeZone = detectTimeZone();
      const parsed = parseScheduleInput(invocation.rawInput, Date.now(), timeZone);
      if (!parsed.ok) return renderError(parsed.error);

      const content = parsed.content;
      const input =
        parsed.target.kind === 'after'
          ? { prompt: content, after_seconds: parsed.target.afterSeconds, time_zone: timeZone }
          : { prompt: content, at: parsed.target.at, time_zone: timeZone };
      const result = await userScheduleCreate(
        delivery === 'user' ? { ...input, delivery } : input,
        invocation.agent,
        ctx,
        maxSchedules,
      );
      if (!result.ok) {
        return { kind: 'error', text: `${result.code}: ${result.message}` };
      }
      try {
        onUserChange?.(invocation.agent);
      } catch {
        /* 通知失败不影响命令成功结果 */
      }
      const epoch =
        parsed.target.kind === 'after' ? Date.now() + parsed.target.afterSeconds * 1000 : parsed.target.epoch;
      const verb = delivery === 'user' ? '将于' : '已设定提醒：';
      const hint = delivery === 'user' ? '（到点会以你的身份发出）' : '（输入框上方蓝色待发条可随时取消）';
      return {
        kind: 'success',
        text: `${verb}${formatAbsolute(epoch, timeZone)}（${formatRelative(epoch, Date.now())}）「${content}」${hint}`,
      };
    };
  };

  const quick: CommandDefinition = {
    name: 'schedule',
    description:
      '定时提醒快捷命令：/schedule <时间> <内容>。时间宽容识别：+30m、+1h30m、30分钟后、1532、15:32、9点半、明天9点、后天 10:00、8月21日 15:32、0821-1532、2026-08-21 15:32。',
    // 声明 input → DSH 命令系统在输入框「等待补全」：选中/回车 /schedule 后
    // 保留 `/schedule ` token + hint 提示，等你写完参数回车才执行；带参整行
    // 回车也走命令系统（不会当普通用户消息直接发给模型）。
    input: {
      hint: '<时间> <内容>，如 1532 检查构建结果；也支持 +30m、明天9点 等格式',
    },
    recordInput: false,
    handler: buildQuickHandler('context'),
  };

  // /later：延迟发送语义 —— 到点以「我」的身份把内容当作真实输入发出。
  // 产品取舍（有意为之，与 dsh-sleep-send 对齐）：它会让无人真实键入的内容
  // 以用户气泡出现，绕过核心的「注入 vs 人键」信任边界；因此只保留在人类
  // 显式输入 `/later` 的路径，工具/面板一律走安全的 `context`（notice 注入）。
  const later: CommandDefinition = {
    name: 'later',
    description:
      '延迟发送：/later <时间> <内容>，到点以你的身份发出该内容（不是提醒，是代发）。时间格式同 /schedule。',
    input: {
      hint: '<时间> <内容>，如 1532 检查构建结果；到点会以你的身份发出',
    },
    recordInput: false,
    handler: buildQuickHandler('user'),
  };

  return [create, list, del, edit, quick, later];
}

/** 注册三个命令，返回统一 disposer。 */
export function registerUserScheduleCommands(
  ctx: Context,
  maxSchedules: number = DEFAULT_MAX_SCHEDULES,
  onUserChange?: UserChangeNotifier,
): () => void {
  const disposers = userScheduleCommands(ctx, maxSchedules, onUserChange).map((definition) => {
    try {
      return ctx.commands.register(definition);
    } catch (error) {
      ctx.logger.warn(
        `session-scheduler: 命令 ${definition.name} 注册失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return () => undefined;
    }
  });
  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
