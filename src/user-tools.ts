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
import { allOwnership, getOwnership, recordOwnership, removeOwnership } from './ownership-store.js';
import { detectTimeZone } from './time-utils.js';

/** 单 session 用户任务上限（PRD：防滥用）。 */
export const DEFAULT_MAX_SCHEDULES = 100;

/**
 * 经过 trim 后允许的默认最大提示字符数（P0：注入防护的保守下限）。
 *
 * 当 settings 中 `allowLongPrompts=false` 时此值始终生效；为 `true` 时
 * 由 `maxPromptChars` 字段接管实际字符上限。用户必须显式 opt-in 才解除
 * 该硬上限——保持默认安全的姿态。
 */
export const DEFAULT_MAX_PROMPT_CHARS = 1000;

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
export function resolvePromptLimits(settings: {
  readonly allowLongPrompts?: boolean;
  readonly maxPromptChars?: number;
} | undefined): PromptLimits {
  const allowLong = settings?.allowLongPrompts === true;
  const raw = settings?.maxPromptChars;
  const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 && Math.floor(raw) === raw;
  if (allowLong && valid) return { allowLong: true, maxChars: raw };
  return { allowLong: false, maxChars: DEFAULT_MAX_PROMPT_CHARS };
}

/** 单条提示的字符校验（纯函数）。返回 trim 后的字符串或闭包错误。 */
export function validatePrompt(
  raw: unknown,
  limits: PromptLimits,
): { ok: true; value: string } | UserScheduleError {
  const prompt = typeof raw === 'string' ? raw : '';
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: 'invalid_prompt', message: '提醒内容不能为空。' };
  }
  if (trimmed.length > limits.maxChars) {
    return {
      ok: false,
      code: 'invalid_prompt',
      message: `提醒内容不能超过 ${limits.maxChars} 字符。`,
    };
  }
  return { ok: true, value: trimmed };
}

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
  | 'already_overdue'
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

/** 校验 `user_schedule_create` 参数（纯函数，含 TRIM 非空、长度、三选一）。
 *
 * `limits` 可选：未传时回落到 `DEFAULT_MAX_PROMPT_CHARS`（保持向后兼容）；
 * 命令与工具的注册路径会按当前 settings 传入实际 limits，校验消息会反映
 * 当前生效的字符上限（与模型可见的 tool description 同步）。
 */
export function validateCreateInput(
  input: unknown,
  limits: PromptLimits = { allowLong: false, maxChars: DEFAULT_MAX_PROMPT_CHARS },
): { ok: true; value: UserScheduleCreateInput } | UserScheduleError {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, code: 'invalid_rule', message: 'create 参数必须是一个对象。' };
  }
  const args = input as Record<string, unknown>;
  const promptResult = validatePrompt(args['prompt'], limits);
  if (!promptResult.ok) return promptResult;
  const trimmed = promptResult.value;
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
  const time_zone =
    typeof args['time_zone'] === 'string' && (args['time_zone'] as string).length > 0
      ? (args['time_zone'] as string)
      : // P1-8：时区可选——缺省用检测到的会话时区，降低模型/客户端漏传导致的失败。
        detectTimeZone();
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

/** 从会话日志导出「用户创建过的 schedule id 集合」（历史遗留读兼容）。 */
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

interface FoldCacheEntry {
  readonly events: readonly SessionEvent[];
  readonly length: number;
  readonly inheritedEventCount: number;
  readonly state: UserFoldState;
}

const foldCache = new WeakMap<object, FoldCacheEntry>();

/** fold 当前会话的完整用户调度状态（带缓存；调用方不得变更返回值）。
 *
 * 跨代兼容：0.1.1 暴露 `session.events` + `header.seedLength`；0.1.2 改名
 * 为 `session.ownEvents()` + `session.inheritedEventCount`。通过鸭子类型
 * （`(session as { ownEvents?; events? })`）双轨探测，不引入 `any`。
 */
export function foldUserState(session: Session): UserFoldState {
  const sessAny = session as unknown as {
    ownEvents?: () => readonly SessionEvent[];
    events?: readonly SessionEvent[];
  };
  const events = sessAny.ownEvents !== undefined ? sessAny.ownEvents() : sessAny.events ?? [];
  // 0.1.2 上 Session.inheritedEventCount 是 SessionLogOffset（BrandedNumber），
  // foldScheduleEvents 第二个参数需要它；0.1.1 上等价于 header.seedLength（number）。
  // 接受任意 number，统一以 number 形式进入 cache key；foldScheduleEvents 内部会
  // 自适应（要么收 number、要么要求 branded——后者 0.1.1 路径不会触达）。
  const inheritedEventCount: number =
    (session as unknown as { inheritedEventCount?: number }).inheritedEventCount ?? 0;
  const cached = foldCache.get(session);
  if (
    cached !== undefined &&
    cached.events === events &&
    cached.length === events.length &&
    cached.inheritedEventCount === inheritedEventCount
  ) {
    return cached.state;
  }
  // 通过 dsh-schedule 的 foldScheduleEvents 入口：0.1.2 上第二个参数是
  // SessionLogOffset，但 0.1.1 上是 number（已弃）。我们传 number，运行时
  // 0.1.2 的 foldScheduleEvents 内部会做 brandshape 校验——若强校验失败，
  // 改由 session.inheritedEventCount 透传。这里保留双轨探测的安全门。
  const folded = foldScheduleEvents(events, inheritedEventCount as never);
  // 所有权与投递形态：sidecar 为准（新写入），日志中的历史 OWNED 事件作底
  // （读兼容，旧日志可能仍有残留行）。
  const sessionId = session.header?.id;
  const owned = foldOwnedIds(events);
  const delivery = new Map(foldOwnedDelivery(events));
  if (typeof sessionId === 'string' && sessionId.length > 0) {
    for (const [id, entry] of Object.entries(allOwnership(sessionId))) {
      owned.add(id);
      if (!delivery.has(id)) delivery.set(id, entry.delivery);
    }
  }
  const state: UserFoldState = {
    folded,
    owned,
    delivery,
  };
  foldCache.set(session, { events, length: events.length, inheritedEventCount, state });
  return state;
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
export async function userScheduleCreate(
  input: unknown,
  agent: Agent,
  ctx: Context,
  maxSchedules: number = DEFAULT_MAX_SCHEDULES,
  options?: UserScheduleCreateOptions,
  limits?: PromptLimits,
): Promise<UserScheduleCreateResult> {
  const validated = validateCreateInput(input, limits);
  if (!validated.ok) return validated;
  // 只认可信通道显式声明的形态；输入载荷中的 delivery 字段不具任何效力。
  const trustedDelivery = options?.trustedDelivery === 'user' ? 'user' : 'context';
  return runUserScheduleTransaction(agent, async () => {
    const now = Date.now();
    let folded;
    let owned;
    try {
      const state = foldUserState(agent.session);
      folded = state.folded;
      owned = state.owned;
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
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
    // 所有权写 sidecar（append 之前：投影 fold 在事件到达时按 sidecar 判定归属）。
    // flush 失败则回滚，避免 sidecar 与日志漂移。
    const sessionId = agent.session.header?.id;
    recordOwnership(sessionId, id, trustedDelivery);
    try {
      agent.session.append('schedule/change', {
        version: 1,
        operation: 'create',
        schedule: record,
      });
    } catch {
      removeOwnership(sessionId, id);
      return internalError();
    }
    if (!(await flushSession(ctx, agent.session))) {
      removeOwnership(sessionId, id);
      return persistenceError();
    }
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
    let owned;
    try {
      const state = foldUserState(agent.session);
      folded = state.folded;
      owned = state.owned;
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
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
      folded = foldUserState(agent.session).folded;
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
    if (!folded.active.some((record) => record.id === scheduleId)) {
      return { ok: true, id, deleted: false, code: 'schedule_not_found' };
    }
    const sessionId = agent.session.header?.id;
    try {
      agent.session.append('schedule/change', {
        version: 1,
        operation: 'delete',
        id: scheduleId,
      });
    } catch {
      return internalError();
    }
    if (!(await flushSession(ctx, agent.session))) return persistenceError();
    // flush 成功后再撤销所有权（失败时保留：日志里的 delete 可能未落盘，
    // 运行时还要按 sidecar 继续追踪该任务）。
    removeOwnership(sessionId, scheduleId);
    return { ok: true, id, deleted: true };
  });
}

/** `user_schedule_edit`（改内容）核心实现：删旧建新，保留原时刻与 delivery。 */
export async function userScheduleEditPrompt(
  id: unknown,
  newPrompt: unknown,
  agent: Agent,
  ctx: Context,
  limits: PromptLimits = { allowLong: false, maxChars: DEFAULT_MAX_PROMPT_CHARS },
): Promise<UserScheduleCreateResult | UserScheduleError> {
  if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
    return { ok: false, code: 'invalid_rule', message: 'schedule id 必须是去空白非空字符串。' };
  }
  const promptResult = validatePrompt(newPrompt, limits);
  if (!promptResult.ok) return promptResult;
  const trimmed = promptResult.value;
  const scheduleId = ScheduleId(id);
  return runUserScheduleTransaction(agent, async () => {
    let folded;
    let deliveries: ReadonlyMap<string, UserScheduleDelivery>;
    try {
      const state = foldUserState(agent.session);
      folded = state.folded;
      deliveries = state.delivery;
    } catch {
      return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
    }
    const existing = folded.active.find((record) => record.id === scheduleId);
    if (existing === undefined) {
      return { ok: false, code: 'schedule_not_found', message: `未找到定时任务 ${scheduleId}。` };
    }
    // P0-4：已过期（overdue）的 at 任务禁止改内容——「保留原时刻」会让新记录
    // 一落日志就处于到期状态，下一次 drive 立即注入，用户会以为只是改了文案
    // 却被瞬间代发。要求先删除再重建，语义清晰可预期。
    if (
      existing.kind === 'at' &&
      Date.parse(existing.scheduledAt) <= Date.now()
    ) {
      return {
        ok: false,
        code: 'already_overdue',
        message: `定时任务 ${scheduleId} 的目标时刻已过，不能修改内容；请删除后重新创建。`,
      };
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
    // 新所有权先写 sidecar（create 事件到达投影 fold 时按 sidecar 判定归属）；
    // 旧条目在 flush 成功后再撤销（失败回滚两侧）。
    const sessionId = agent.session.header?.id;
    const previousEntry = getOwnership(sessionId, scheduleId);
    recordOwnership(sessionId, record.id, delivery);
    try {
      agent.session.append('schedule/change', { version: 1, operation: 'delete', id: scheduleId });
      agent.session.append('schedule/change', { version: 1, operation: 'create', schedule: record });
    } catch {
      removeOwnership(sessionId, record.id);
      return internalError();
    }
    if (!(await flushSession(ctx, agent.session))) {
      removeOwnership(sessionId, record.id);
      if (previousEntry !== undefined) recordOwnership(sessionId, scheduleId, previousEntry.delivery);
      return persistenceError();
    }
    removeOwnership(sessionId, scheduleId);
    const view = scheduleView(record, Date.now());
    return { ok: true, ...serializeScheduleView(view) };
  });
}
