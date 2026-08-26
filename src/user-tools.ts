/**
 * 用户工具核心实现：`user_schedule_create` / `user_schedule_list` /
 * `user_schedule_delete`。
 *
 * 复用 dsh-schedule 导出的领域函数（fold / allocate / 各 create 函数 /
 * scheduleView），
 * 写入**完全兼容**的 `schedule/change` 事件（不携带 `source` 字段，避免破坏
 * dsh-schedule 严格解码），并额外追加本插件自有的伴生所有权事件
 * `session-scheduler/user-schedule` 来标记用户来源（GUI 据此展示）。
 *
 * 所有读改写操作按 agent 串行化（同 dsh-schedule 的 agent-scoped 队列），
 * 保证 id 分配与 fold 不会并发竞争。
 * @module dsh-session-scheduler/user-tools
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import {
  ScheduleId,
  ScheduleInputError,
  allocateScheduleId,
  createAfterScheduleRecord,
  createAtScheduleRecord,
  createEveryScheduleRecord,
  foldScheduleEvents,
  scheduleView,
} from '@deepseek-ai/dsh-schedule';
import type { ScheduleRecord, ScheduleView } from '@deepseek-ai/dsh-schedule';
import { OWNED_EVENT } from './domain.js';
import type { UserScheduleOwnedChange, UserScheduleDelivery } from './domain.js';

/** 单 session 用户任务上限（PRD：防滥用）。 */
export const DEFAULT_MAX_SCHEDULES = 100;

/** 经过 trim 后允许的最大提示字符数。 */
export const MAX_PROMPT_CHARS = 1000;

/** 用户工具稳定的闭包错误集合（在 dsh-schedule 闭包之上追加本插件专用码）。 */
export type UserScheduleErrorCode =
  | 'invalid_prompt'
  | 'invalid_selector'
  | 'invalid_time_zone'
  | 'not_future'
  | 'time_out_of_range'
  | 'frequency_too_high'
  | 'invalid_rule'
  | 'schedule_not_found'
  | 'quota_exceeded'
  | 'persistence_uncertain'
  | 'internal_error';

/** 封闭错误值。 */
export interface UserScheduleError {
  readonly ok: false;
  readonly code: UserScheduleErrorCode;
  readonly message: string;
}

/** 成功值。 */
export type UserScheduleResult<TSuccess> = TSuccess | UserScheduleError;

/** `user_schedule_create` 成功响应。 */
export type UserScheduleCreateResult = UserScheduleResult<ScheduleRecordView & { readonly ok: true }>;

/** `user_schedule_list` 成功响应。 */
export type UserScheduleListResult = UserScheduleResult<{
  readonly ok: true;
  readonly schedules: readonly ScheduleRecordView[];
}>;

/** `user_schedule_delete` 成功响应。 */
export type UserScheduleDeleteResult = UserScheduleResult<
  | { readonly ok: true; readonly id: string; readonly deleted: true }
  | { readonly ok: true; readonly id: string; readonly deleted: false; readonly code: 'schedule_not_found' }
>;

/** `user_schedule_create` 的规范化输入。 */
export interface UserScheduleCreateInput {
  readonly prompt: string;
  readonly time_zone: string;
  readonly after_seconds?: number;
  readonly at?: string | { readonly date: string; readonly time: string; readonly time_zone: string };
  readonly every_seconds?: number;
}

/** 校验 `user_schedule_create` 参数（纯函数，含 TRIM 非空、长度、三选一）。 */
export function validateCreateInput(
  input: unknown,
): { ok: true; value: UserScheduleCreateInput } | UserScheduleError {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, code: 'invalid_rule', message: 'create 参数必须是一个对象。' };
  }
  const args = input as Record<string, unknown>;
  const prompt = typeof args['prompt'] === 'string' ? (args['prompt'] as string) : '';
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: 'invalid_prompt', message: '提醒内容不能为空。' };
  }
  if (trimmed.length > MAX_PROMPT_CHARS) {
    return { ok: false, code: 'invalid_prompt', message: `提醒内容不能超过 ${MAX_PROMPT_CHARS} 字符。` };
  }
  const selectorCount =
    Number(args['after_seconds'] !== undefined) +
    Number(args['at'] !== undefined) +
    Number(args['every_seconds'] !== undefined);
  if (selectorCount !== 1) {
    return {
      ok: false,
      code: 'invalid_selector',
      message: 'after_seconds / at / every_seconds 必须且只能提供一项。',
    };
  }
  const time_zone = typeof args['time_zone'] === 'string' ? (args['time_zone'] as string) : '';
  if (time_zone.length === 0) {
    return { ok: false, code: 'invalid_time_zone', message: 'time_zone 为必填项，请提供合法的 IANA 时区。' };
  }
  if (!isValidIanaZone(time_zone)) {
    return { ok: false, code: 'invalid_time_zone', message: 'time_zone 必须是合法的 IANA 时区。' };
  }
  if (args['at'] !== undefined) {
    const at = args['at'];
    if (typeof at === 'string') {
      // 显式偏移字符串：交给 dsh-schedule 解析
    } else if (typeof at === 'object' && at !== null && !Array.isArray(at)) {
      const obj = at as Record<string, unknown>;
      if (typeof obj['date'] !== 'string' || typeof obj['time'] !== 'string' || typeof obj['time_zone'] !== 'string') {
        return { ok: false, code: 'invalid_rule', message: 'at 对象必须包含 date / time / time_zone。' };
      }
      if (!isValidIanaZone(obj['time_zone'])) {
        return { ok: false, code: 'invalid_time_zone', message: 'at.time_zone 必须是合法的 IANA 时区。' };
      }
    } else {
      return { ok: false, code: 'invalid_rule', message: 'at 必须是字符串或 {date, time, time_zone} 对象。' };
    }
  }
  return { ok: true, value: { prompt: trimmed, time_zone, ...remainingSelectors(args) } };
}

function remainingSelectors(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (args['after_seconds'] !== undefined) out['after_seconds'] = args['after_seconds'];
  if (args['at'] !== undefined) out['at'] = args['at'];
  if (args['every_seconds'] !== undefined) out['every_seconds'] = args['every_seconds'];
  return out;
}

/** 校验 IANA 时区（与 dsh-schedule canonicalize 同源，容错）。 */
export function isValidIanaZone(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** 从会话日志导出「用户创建过的 schedule id 集合」。 */
export function foldOwnedIds(events: readonly SessionEvent[]): Set<string> {
  const owned = new Set<string>();
  for (const event of events) {
    if (event.type !== OWNED_EVENT) continue;
    const data = event.data as unknown as UserScheduleOwnedChange;
    if (typeof data !== 'object' || data === null || data.version !== 1) continue;
    if (data.operation === 'add') owned.add(data.id);
    else if (data.operation === 'remove') owned.delete(data.id);
  }
  return owned;
}

/**
 * 从会话日志导出「schedule id → 到点注入形态」映射（默认 `context`）。
 * 供 runtime 在 dispatch 时按 `/later` 与 `/schedule` 分别注入。
 */
export function foldOwnedDelivery(
  events: readonly SessionEvent[],
): ReadonlyMap<string, UserScheduleDelivery> {
  const map = new Map<string, UserScheduleDelivery>();
  for (const event of events) {
    if (event.type !== OWNED_EVENT) continue;
    const data = event.data as unknown as UserScheduleOwnedChange;
    if (typeof data !== 'object' || data === null || data.version !== 1) continue;
    if (data.operation === 'remove') {
      map.delete(data.id);
      continue;
    }
    map.set(data.id, data.delivery ?? 'context');
  }
  return map;
}

/** 从 create 输入里读取可选 delivery（仅命令/内部通道可传，工具不透出）。 */
function readDelivery(input: unknown): UserScheduleDelivery {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const raw = (input as Record<string, unknown>)['delivery'];
    return raw === 'user' ? 'user' : 'context';
  }
  return 'context';
}

/** 稳定内部错误（不透出异常细节）。 */
export function internalError(): UserScheduleError {
  return { ok: false, code: 'internal_error', message: '定时任务操作失败，请重试。' };
}

/** 稳定持久化不确定错误。 */
export function persistenceError(): UserScheduleError {
  return {
    ok: false,
    code: 'persistence_uncertain',
    message: '任务持久化未确认，请用 user_schedule_list 复核后再依赖该结果。',
  };
}

/** 把 dsh-schedule 的 ScheduleInputError 翻译为闭包错误值。 */
export function toInputError(error: unknown): UserScheduleError {
  if (error instanceof ScheduleInputError) {
    return { ok: false, code: error.code, message: error.message };
  }
  return internalError();
}

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
export function serializeScheduleView(view: ScheduleView): ScheduleRecordView {
  return {
    id: view.id,
    kind: view.kind,
    prompt: view.prompt,
    ...(view.kind === 'after' ? { after_seconds: view.afterSeconds } : {}),
    ...(view.kind === 'every' ? { every_seconds: view.everySeconds } : {}),
    scheduled_at: view.scheduledAt,
    state: view.state,
    delivery_mode: view.deliveryMode,
    source: 'user-tool',
  };
}

/** 每个 agent 一个事务尾，串行化用户的读改写操作。 */
const tails = new WeakMap<object, Promise<void>>();

/** 在当前 agent 的事务尾之后运行操作。 */
export function runUserScheduleTransaction<T>(
  agent: Agent,
  operation: () => Promise<T>,
): Promise<T> {
  const run = (tails.get(agent) ?? Promise.resolve()).then(operation);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(agent, tail);
  try {
    return run;
  } finally {
    if (tails.get(agent) === tail) tails.delete(agent);
  }
}

/** 等待一个成功的持久化 barrier。 */
async function flushSession(ctx: Context, session: Session): Promise<boolean> {
  try {
    return (await ctx.sessions.flush(session)) === true;
  } catch {
    return false;
  }
}

/** 构造一条通过与 dsh-schedule 完全兼容的 `schedule/change` 记录。 */
function buildScheduleRecord(input: UserScheduleCreateInput, id: ReturnType<typeof ScheduleId>, now: number): ScheduleRecord {
  if (input.at !== undefined) {
    return createAtScheduleRecord(id, input.prompt, input.at as Parameters<typeof createAtScheduleRecord>[2], now);
  }
  if (input.after_seconds !== undefined) {
    return createAfterScheduleRecord(id, input.prompt, input.after_seconds, now);
  }
  return createEveryScheduleRecord(id, input.prompt, input.every_seconds as number, now);
}

/** `user_schedule_create` 核心实现。 */
export async function userScheduleCreate(
  input: unknown,
  agent: Agent,
  ctx: Context,
  maxSchedules: number = DEFAULT_MAX_SCHEDULES,
): Promise<UserScheduleCreateResult> {
  const validated = validateCreateInput(input);
  if (!validated.ok) return validated;
  return runUserScheduleTransaction(agent, async () => {
    const now = Date.now();
    let folded;
    try {
      folded = foldScheduleEvents(agent.session.events, agent.session.header.seedLength ?? 0);
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
    const owned = foldOwnedIds(agent.session.events);
    const activeCount = folded.active.filter((record) => owned.has(record.id)).length;
    if (activeCount >= maxSchedules) {
      return {
        ok: false,
        code: 'quota_exceeded',
        message: `当前会话最多 ${maxSchedules} 个定时任务，请先删除部分任务。`,
      };
    }
    const id = allocateScheduleId(folded);
    let record: ScheduleRecord;
    try {
      record = buildScheduleRecord(validated.value, id, now);
    } catch (error) {
      return toInputError(error);
    }
    try {
      agent.session.append('schedule/change', {
        version: 1,
        operation: 'create',
        schedule: record,
      });
      agent.session.append(OWNED_EVENT, {
        version: 1,
        operation: 'add',
        id,
        ...(readDelivery(input) === 'user' ? { delivery: 'user' as const } : {}),
      });
    } catch {
      return internalError();
    }
    if (!(await flushSession(ctx, agent.session))) return persistenceError();
    const view = scheduleView(record, Date.now());
    return {
      ok: true,
      ...serializeScheduleView(view),
    };
  });
}

/** `user_schedule_list` 核心实现。 */
export async function userScheduleList(
  agent: Agent,
  ctx: Context,
): Promise<UserScheduleListResult> {
  return runUserScheduleTransaction(agent, async () => {
    let folded;
    try {
      folded = foldScheduleEvents(agent.session.events, agent.session.header.seedLength ?? 0);
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
    const owned = foldOwnedIds(agent.session.events);
    const now = Date.now();
    const schedules = folded.active
      .filter((record) => owned.has(record.id))
      .map((record) => serializeScheduleView(scheduleView(record, now)));
    return { ok: true, schedules };
  });
}

/** `user_schedule_delete` 核心实现。 */
export async function userScheduleDelete(
  id: unknown,
  agent: Agent,
  ctx: Context,
): Promise<UserScheduleDeleteResult> {
  if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
    return { ok: false, code: 'invalid_rule', message: 'schedule id 必须是去空白非空字符串。' };
  }
  const scheduleId = ScheduleId(id);
  return runUserScheduleTransaction(agent, async () => {
    let folded;
    try {
      folded = foldScheduleEvents(agent.session.events, agent.session.header.seedLength ?? 0);
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
    if (!folded.active.some((record) => record.id === scheduleId)) {
      return { ok: true, id, deleted: false, code: 'schedule_not_found' };
    }
    try {
      agent.session.append('schedule/change', {
        version: 1,
        operation: 'delete',
        id: scheduleId,
      });
      // 若该 id 曾标记为用户所有，同步撤销所有权声明（幂等）。
      agent.session.append(OWNED_EVENT, {
        version: 1,
        operation: 'remove',
        id: scheduleId,
      });
    } catch {
      return internalError();
    }
    if (!(await flushSession(ctx, agent.session))) return persistenceError();
    return { ok: true, id, deleted: true };
  });
}

/** `user_schedule_edit`（改内容）核心实现：删旧建新，保留原时刻与 delivery。 */
export async function userScheduleEditPrompt(
  id: unknown,
  newPrompt: unknown,
  agent: Agent,
  ctx: Context,
): Promise<UserScheduleCreateResult | UserScheduleError> {
  if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
    return { ok: false, code: 'invalid_rule', message: 'schedule id 必须是去空白非空字符串。' };
  }
  const trimmed = typeof newPrompt === 'string' ? newPrompt.trim() : '';
  if (trimmed.length === 0) {
    return { ok: false, code: 'invalid_prompt', message: '提醒内容不能为空。' };
  }
  if (trimmed.length > MAX_PROMPT_CHARS) {
    return { ok: false, code: 'invalid_prompt', message: `提醒内容不能超过 ${MAX_PROMPT_CHARS} 字符。` };
  }
  const scheduleId = ScheduleId(id);
  return runUserScheduleTransaction(agent, async () => {
    let folded;
    let deliveries: ReadonlyMap<string, UserScheduleDelivery>;
    try {
      folded = foldScheduleEvents(agent.session.events, agent.session.header.seedLength ?? 0);
      deliveries = foldOwnedDelivery(agent.session.events);
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
    const existing = folded.active.find((record) => record.id === scheduleId);
    if (existing === undefined) {
      return { ok: false, code: 'schedule_not_found', message: `未找到定时任务 ${scheduleId}。` };
    }
    const now = Date.now();
    let record: ScheduleRecord;
    try {
      if (existing.kind === 'after') {
        record = createAfterScheduleRecord(
          allocateScheduleId(folded),
          trimmed,
          // 编辑会重置从「现在」起的倒计时；保留原间隔长度
          existing.afterSeconds,
          now,
        );
      } else if (existing.kind === 'at') {
        record = createAtScheduleRecord(
          allocateScheduleId(folded),
          trimmed,
          existing.scheduledAt, // ISO 字符串，保留原时刻（不重置到未来）
          now,
        );
      } else {
        record = createEveryScheduleRecord(
          allocateScheduleId(folded),
          trimmed,
          existing.everySeconds ?? 300,
          now,
        );
      }
    } catch (error) {
      return toInputError(error);
    }
    const delivery = deliveries.get(scheduleId) ?? 'context';
    try {
      agent.session.append('schedule/change', { version: 1, operation: 'delete', id: scheduleId });
      agent.session.append(OWNED_EVENT, { version: 1, operation: 'remove', id: scheduleId });
      agent.session.append('schedule/change', { version: 1, operation: 'create', schedule: record });
      agent.session.append(OWNED_EVENT, {
        version: 1,
        operation: 'add',
        id: record.id,
        ...(delivery === 'user' ? { delivery: 'user' as const } : {}),
      });
    } catch {
      return internalError();
    }
    if (!(await flushSession(ctx, agent.session))) return persistenceError();
    const view = scheduleView(record, Date.now());
    return { ok: true, ...serializeScheduleView(view) };
  });
}
