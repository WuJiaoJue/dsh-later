import { ScheduleId, ScheduleInputError, allocateScheduleId, createAfterScheduleRecord, createAtScheduleRecord, createEveryScheduleRecord, foldScheduleEvents, scheduleView, } from '@deepseek-ai/dsh-schedule';
import { OWNED_EVENT } from './domain.js';
import { allOwnership, allPaused, findPausedByScheduleId, findScheduleIdByUid, getOwnership, getPaused, newTaskUid, recordOwnership, recordPaused, removeOwnership, removePaused, } from './ownership-store.js';
import { detectTimeZone } from './time-utils.js';
import { readInheritedEventCount, readOwnEvents } from './upstream-compat.js';
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
/**
 * 从 settings 解析出实际生效的 PromptLimits。
 * 容错非法值（NaN / 负数 / 非数）回落 DEFAULT_MAX_PROMPT_CHARS。
 */
export function resolvePromptLimits(settings) {
    const allowLong = settings?.allowLongPrompts === true;
    const raw = settings?.maxPromptChars;
    const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 && Math.floor(raw) === raw;
    if (allowLong && valid)
        return { allowLong: true, maxChars: raw };
    return { allowLong: false, maxChars: DEFAULT_MAX_PROMPT_CHARS };
}
/** 单条提示的字符校验（纯函数）。返回 trim 后的字符串或闭包错误。 */
export function validatePrompt(raw, limits) {
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
/** 校验 `user_schedule_create` 参数（纯函数，含 TRIM 非空、长度、三选一）。
 *
 * `limits` 可选：未传时回落到 `DEFAULT_MAX_PROMPT_CHARS`（保持向后兼容）；
 * 命令与工具的注册路径会按当前 settings 传入实际 limits，校验消息会反映
 * 当前生效的字符上限（与模型可见的 tool description 同步）。
 */
export function validateCreateInput(input, limits = { allowLong: false, maxChars: DEFAULT_MAX_PROMPT_CHARS }) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return { ok: false, code: 'invalid_rule', message: 'create 参数必须是一个对象。' };
    }
    const args = input;
    const promptResult = validatePrompt(args['prompt'], limits);
    if (!promptResult.ok)
        return promptResult;
    const trimmed = promptResult.value;
    const selectorCount = Number(args['after_seconds'] !== undefined) +
        Number(args['at'] !== undefined) +
        Number(args['every_seconds'] !== undefined);
    if (selectorCount !== 1) {
        return {
            ok: false,
            code: 'invalid_selector',
            message: 'after_seconds / at / every_seconds 必须且只能提供一项。',
        };
    }
    const time_zone = typeof args['time_zone'] === 'string' && args['time_zone'].length > 0
        ? args['time_zone']
        : // P1-8：时区可选——缺省用检测到的会话时区，降低模型/客户端漏传导致的失败。
            detectTimeZone();
    if (!isValidIanaZone(time_zone)) {
        return { ok: false, code: 'invalid_time_zone', message: 'time_zone 必须是合法的 IANA 时区。' };
    }
    if (args['at'] !== undefined) {
        const at = args['at'];
        if (typeof at === 'string') {
            // 显式偏移字符串：交给 dsh-schedule 解析
        }
        else if (typeof at === 'object' && at !== null && !Array.isArray(at)) {
            const obj = at;
            if (typeof obj['date'] !== 'string' || typeof obj['time'] !== 'string' || typeof obj['time_zone'] !== 'string') {
                return { ok: false, code: 'invalid_rule', message: 'at 对象必须包含 date / time / time_zone。' };
            }
            if (!isValidIanaZone(obj['time_zone'])) {
                return { ok: false, code: 'invalid_time_zone', message: 'at.time_zone 必须是合法的 IANA 时区。' };
            }
        }
        else {
            return { ok: false, code: 'invalid_rule', message: 'at 必须是字符串或 {date, time, time_zone} 对象。' };
        }
    }
    return { ok: true, value: { prompt: trimmed, time_zone, ...remainingSelectors(args) } };
}
function remainingSelectors(args) {
    const out = {};
    if (args['after_seconds'] !== undefined)
        out['after_seconds'] = args['after_seconds'];
    if (args['at'] !== undefined)
        out['at'] = args['at'];
    if (args['every_seconds'] !== undefined)
        out['every_seconds'] = args['every_seconds'];
    return out;
}
/** 校验 IANA 时区（与 dsh-schedule canonicalize 同源，容错）。 */
export function isValidIanaZone(value) {
    if (typeof value !== 'string' || value.length === 0)
        return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    }
    catch {
        return false;
    }
}
/** 从会话日志导出「用户创建过的 schedule id 集合」（历史遗留读兼容）。 */
export function foldOwnedIds(events) {
    const owned = new Set();
    for (const event of events) {
        if (event.type !== OWNED_EVENT)
            continue;
        const data = event.data;
        if (typeof data !== 'object' || data === null || data.version !== 1)
            continue;
        if (data.operation === 'add')
            owned.add(data.id);
        else if (data.operation === 'remove')
            owned.delete(data.id);
    }
    return owned;
}
/**
 * 从会话日志导出「schedule id → 到点注入形态」映射（默认 `context`）。
 * 供 runtime 在 dispatch 时按 `/later` 与 `/schedule` 分别注入。
 */
export function foldOwnedDelivery(events) {
    const map = new Map();
    for (const event of events) {
        if (event.type !== OWNED_EVENT)
            continue;
        const data = event.data;
        if (typeof data !== 'object' || data === null || data.version !== 1)
            continue;
        if (data.operation === 'remove') {
            map.delete(data.id);
            continue;
        }
        map.set(data.id, data.delivery ?? 'context');
    }
    return map;
}
const foldCache = new WeakMap();
/** fold 当前会话的完整用户调度状态（带缓存；调用方不得变更返回值）。
 *
 * 跨代 Session API 探测已收敛到 `upstream-compat.ts`（readOwnEvents /
 * readInheritedEventCount）——新 rc 若再改名只动那一处。
 */
export function foldUserState(session) {
    const events = readOwnEvents(session);
    const inheritedEventCount = readInheritedEventCount(session);
    const cached = foldCache.get(session);
    if (cached !== undefined &&
        cached.events === events &&
        cached.length === events.length &&
        cached.inheritedEventCount === inheritedEventCount) {
        return cached.state;
    }
    // number 形式进入 foldScheduleEvents：0.1.2 brandshape 校验接受 safe integer；
    // 0.1.1 直接收 number。
    const folded = foldScheduleEvents(events, inheritedEventCount);
    // 所有权与投递形态：sidecar 为准（新写入），日志中的历史 OWNED 事件作底
    // （读兼容，旧日志可能仍有残留行）。
    const sessionId = session.header?.id;
    const owned = foldOwnedIds(events);
    const delivery = new Map(foldOwnedDelivery(events));
    if (typeof sessionId === 'string' && sessionId.length > 0) {
        for (const [id, entry] of Object.entries(allOwnership(sessionId))) {
            owned.add(id);
            if (!delivery.has(id))
                delivery.set(id, entry.delivery);
        }
    }
    const state = {
        folded,
        owned,
        delivery,
    };
    foldCache.set(session, { events, length: events.length, inheritedEventCount, state });
    return state;
}
/** 稳定内部错误（不透出异常细节）。 */
export function internalError() {
    return { ok: false, code: 'internal_error', message: '定时任务操作失败，请重试。' };
}
/** 稳定持久化不确定错误。 */
export function persistenceError() {
    return {
        ok: false,
        code: 'persistence_uncertain',
        message: '任务持久化未确认，请用 user_schedule_list 复核后再依赖该结果。',
    };
}
/** 把 dsh-schedule 的 ScheduleInputError 翻译为闭包错误值。 */
export function toInputError(error) {
    if (error instanceof ScheduleInputError) {
        return { ok: false, code: error.code, message: error.message };
    }
    return internalError();
}
/** 把 dsh-schedule 的 view 序列化为 snake_case 记录。 */
export function serializeScheduleView(view) {
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
const tails = new WeakMap();
/** 在当前 agent 的事务尾之后运行操作。 */
export function runUserScheduleTransaction(agent, operation) {
    const run = (tails.get(agent) ?? Promise.resolve()).then(operation);
    const tail = run.then(() => undefined, () => undefined);
    tails.set(agent, tail);
    try {
        return run;
    }
    finally {
        if (tails.get(agent) === tail)
            tails.delete(agent);
    }
}
/** 等待一个成功的持久化 barrier。 */
async function flushSession(ctx, session) {
    try {
        return (await ctx.sessions.flush(session)) === true;
    }
    catch {
        return false;
    }
}
/** 构造一条通过与 dsh-schedule 完全兼容的 `schedule/change` 记录。 */
function buildScheduleRecord(input, id, now) {
    if (input.at !== undefined) {
        return createAtScheduleRecord(id, input.prompt, input.at, now);
    }
    if (input.after_seconds !== undefined) {
        return createAfterScheduleRecord(id, input.prompt, input.after_seconds, now);
    }
    return createEveryScheduleRecord(id, input.prompt, input.every_seconds, now);
}
/** `user_schedule_create` 核心实现。 */
export async function userScheduleCreate(input, agent, ctx, maxSchedules = DEFAULT_MAX_SCHEDULES, options, limits) {
    const validated = validateCreateInput(input, limits);
    if (!validated.ok)
        return validated;
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
        }
        catch {
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
        let record;
        try {
            record = buildScheduleRecord(validated.value, id, now);
        }
        catch (error) {
            return toInputError(error);
        }
        // 所有权写 sidecar（append 之前：投影 fold 在事件到达时按 sidecar 判定归属）。
        // flush 失败则回滚，避免 sidecar 与日志漂移。
        const sessionId = agent.session.header?.id;
        recordOwnership(sessionId, id, trustedDelivery, newTaskUid(), record.kind === 'after' ? record.afterSeconds : undefined);
        try {
            agent.session.append('schedule/change', {
                version: 1,
                operation: 'create',
                schedule: record,
            });
        }
        catch {
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
export async function userScheduleList(agent, ctx) {
    return runUserScheduleTransaction(agent, async () => {
        let folded;
        let owned;
        try {
            const state = foldUserState(agent.session);
            folded = state.folded;
            owned = state.owned;
        }
        catch {
            return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
        }
        const now = Date.now();
        const schedules = folded.active
            .filter((record) => owned.has(record.id))
            .map((record) => serializeScheduleView(scheduleView(record, now)));
        return { ok: true, schedules };
    });
}
/** `user_schedule_delete` 核心实现。id 可为 scheduleId 或稳定 uid。 */
export async function userScheduleDelete(id, agent, ctx) {
    if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
        return { ok: false, code: 'invalid_rule', message: 'schedule id 必须是去空白非空字符串。' };
    }
    return runUserScheduleTransaction(agent, async () => {
        const sessionId = agent.session.header?.id;
        let folded;
        try {
            folded = foldUserState(agent.session).folded;
        }
        catch {
            return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
        }
        // 1) 活动任务：uid → scheduleId
        const activeId = resolveActiveScheduleId(sessionId, id);
        if (folded.active.some((record) => record.id === activeId)) {
            try {
                agent.session.append('schedule/change', {
                    version: 1,
                    operation: 'delete',
                    id: ScheduleId(activeId),
                });
            }
            catch {
                return internalError();
            }
            if (!(await flushSession(ctx, agent.session)))
                return persistenceError();
            removeOwnership(sessionId, activeId);
            return { ok: true, id, deleted: true };
        }
        // 2) 暂停项：wire id 即 uid，只清 sidecar。
        //
        // 这里**不能**像活动任务那样补一条 `schedule/change` delete 事件：
        // dsh-schedule 的 fold 要求 delete 必须命中「仍 active」的 id，而该 id 在
        // pause 时就已经被删掉了（见 userSchedulePause），补写会抛
        // `schedule delete targets inactive id`，把整份日志读坏。
        //
        // 后果：投影 cell 不会因 sidecar 变化而重算，`paused[]` 镜像会停留在快照上。
        // 因此 `viewUserScheduleProjection` 改为**以 sidecar 为准重读**（权威存储），
        // 使删除即刻对客户端可见。
        const paused = getPaused(sessionId, id);
        if (paused !== undefined) {
            removePaused(sessionId, id);
            return { ok: true, id, deleted: true };
        }
        return { ok: true, id, deleted: false, code: 'schedule_not_found' };
    });
}
/** `user_schedule_edit`（改内容）核心实现：删旧建新，保留原时刻与 delivery。 */
export async function userScheduleEditPrompt(id, newPrompt, agent, ctx, limits = { allowLong: false, maxChars: DEFAULT_MAX_PROMPT_CHARS }) {
    if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
        return { ok: false, code: 'invalid_rule', message: 'schedule id 必须是去空白非空字符串。' };
    }
    const promptResult = validatePrompt(newPrompt, limits);
    if (!promptResult.ok)
        return promptResult;
    const trimmed = promptResult.value;
    const scheduleId = ScheduleId(id);
    return runUserScheduleTransaction(agent, async () => {
        let folded;
        let deliveries;
        try {
            const state = foldUserState(agent.session);
            folded = state.folded;
            deliveries = state.delivery;
        }
        catch {
            return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
        }
        const existing = folded.active.find((record) => record.id === scheduleId);
        if (existing === undefined) {
            return { ok: false, code: 'schedule_not_found', message: `未找到定时任务 ${scheduleId}。` };
        }
        // P0-4：已过期（overdue）的 at 任务禁止改内容——「保留原时刻」会让新记录
        // 一落日志就处于到期状态，下一次 drive 立即注入，用户会以为只是改了文案
        // 却被瞬间代发。要求先删除再重建，语义清晰可预期。
        if (existing.kind === 'at' &&
            Date.parse(existing.scheduledAt) <= Date.now()) {
            return {
                ok: false,
                code: 'already_overdue',
                message: `定时任务 ${scheduleId} 的目标时刻已过，不能修改内容；请删除后重新创建。`,
            };
        }
        const now = Date.now();
        let record;
        try {
            if (existing.kind === 'after') {
                record = createAfterScheduleRecord(allocateScheduleId(folded), trimmed, 
                // 编辑会重置从「现在」起的倒计时；保留原间隔长度
                existing.afterSeconds, now);
            }
            else if (existing.kind === 'at') {
                record = createAtScheduleRecord(allocateScheduleId(folded), trimmed, existing.scheduledAt, // ISO 字符串，保留原时刻（不重置到未来）
                now);
            }
            else {
                record = createEveryScheduleRecord(allocateScheduleId(folded), trimmed, existing.everySeconds ?? 300, now);
            }
        }
        catch (error) {
            return toInputError(error);
        }
        const delivery = deliveries.get(scheduleId) ?? 'context';
        // 新所有权先写 sidecar（create 事件到达投影 fold 时按 sidecar 判定归属）；
        // 旧条目在 flush 成功后再撤销（失败回滚两侧）。uid 跨编辑保留。
        const sessionId = agent.session.header?.id;
        const previousEntry = getOwnership(sessionId, scheduleId);
        // 编辑 after 会重置倒计时 → 窗口等于新 afterSeconds，不沿用 resume 旧窗口
        recordOwnership(sessionId, record.id, delivery, previousEntry?.uid, record.kind === 'after' ? record.afterSeconds : undefined);
        try {
            agent.session.append('schedule/change', { version: 1, operation: 'delete', id: scheduleId });
            agent.session.append('schedule/change', { version: 1, operation: 'create', schedule: record });
        }
        catch {
            removeOwnership(sessionId, record.id);
            return internalError();
        }
        if (!(await flushSession(ctx, agent.session))) {
            removeOwnership(sessionId, record.id);
            if (previousEntry !== undefined)
                recordOwnership(sessionId, scheduleId, previousEntry.delivery);
            return persistenceError();
        }
        removeOwnership(sessionId, scheduleId);
        const view = scheduleView(record, Date.now());
        return { ok: true, ...serializeScheduleView(view) };
    });
}
/** 把 wire/命令里的 id 解析为当前 active 的日志 schedule id（uid 或 scheduleId）。 */
function resolveActiveScheduleId(sessionId, id) {
    if (getOwnership(sessionId, id) !== undefined)
        return id;
    const byUid = findScheduleIdByUid(sessionId, id);
    return byUid ?? id;
}
/**
 * 暂停一条 **after** 提醒（方案 B）：sidecar 留档 + 日志 delete。
 * 仅 kind==='after' 且未到点；恢复见 {@link userScheduleResume}。
 */
export async function userSchedulePause(id, agent, ctx) {
    if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
        return { ok: false, code: 'invalid_rule', message: 'schedule id 必须是去空白非空字符串。' };
    }
    return runUserScheduleTransaction(agent, async () => {
        const sessionId = agent.session.header?.id;
        let folded;
        let owned;
        let deliveryMap;
        try {
            const state = foldUserState(agent.session);
            folded = state.folded;
            owned = state.owned;
            deliveryMap = state.delivery;
        }
        catch {
            return { ok: false, code: 'internal_error', message: '会话定时日志读取失败。' };
        }
        const scheduleId = resolveActiveScheduleId(sessionId, id);
        const existing = folded.active.find((record) => record.id === scheduleId);
        if (existing === undefined || !owned.has(scheduleId)) {
            return { ok: false, code: 'schedule_not_found', message: `未找到可暂停的定时任务 ${id}。` };
        }
        if (existing.kind !== 'after') {
            return { ok: false, code: 'unsupported_kind', message: '仅支持暂停「再等 N 分钟」类（after）提醒。' };
        }
        const now = Date.now();
        const target = Date.parse(existing.scheduledAt);
        if (!Number.isFinite(target) || target <= now) {
            return {
                ok: false,
                code: 'already_overdue',
                message: '任务已到点，无法暂停；请删除或等待发送。',
            };
        }
        const remainingSeconds = Math.max(1, Math.ceil((target - now) / 1000));
        const ownership = getOwnership(sessionId, scheduleId);
        const uid = ownership?.uid ?? newTaskUid();
        const delivery = deliveryMap.get(scheduleId) ?? ownership?.delivery ?? 'context';
        // 旧条目无 uid 时补写，保证 pause 后有稳定身份
        if (ownership?.uid === undefined) {
            recordOwnership(sessionId, scheduleId, delivery, uid);
        }
        const pausedEntry = {
            uid,
            prompt: existing.prompt,
            delivery,
            kind: 'after',
            remainingSeconds,
            originalScheduledAt: existing.scheduledAt,
            ...(existing.kind === 'after' && existing.afterSeconds !== undefined
                ? { originalAfterSeconds: existing.afterSeconds }
                : {}),
            lastScheduleId: scheduleId,
            pausedAt: now,
        };
        // sidecar 先写（投影 delete 后按 lastScheduleId 挂回 paused 列表）
        recordPaused(sessionId, pausedEntry);
        try {
            agent.session.append('schedule/change', {
                version: 1,
                operation: 'delete',
                id: ScheduleId(scheduleId),
            });
        }
        catch {
            removePaused(sessionId, uid);
            return internalError();
        }
        if (!(await flushSession(ctx, agent.session))) {
            removePaused(sessionId, uid);
            return persistenceError();
        }
        removeOwnership(sessionId, scheduleId);
        return {
            ok: true,
            uid,
            schedule_id: scheduleId,
            remaining_seconds: remainingSeconds,
            scheduled_at: existing.scheduledAt,
        };
    });
}
/** 恢复一条暂停中的 after 提醒：`after_seconds = remaining` 重建；uid 不变。 */
export async function userScheduleResume(uid, agent, ctx, maxSchedules = DEFAULT_MAX_SCHEDULES) {
    if (typeof uid !== 'string' || uid.length === 0 || uid.trim() !== uid) {
        return { ok: false, code: 'invalid_rule', message: 'uid 必须是去空白非空字符串。' };
    }
    return runUserScheduleTransaction(agent, async () => {
        const sessionId = agent.session.header?.id;
        const paused = getPaused(sessionId, uid);
        if (paused === undefined) {
            return { ok: false, code: 'not_paused', message: `未找到暂停中的任务 ${uid}。` };
        }
        let folded;
        let owned;
        try {
            const state = foldUserState(agent.session);
            folded = state.folded;
            owned = state.owned;
        }
        catch {
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
        const now = Date.now();
        let record;
        try {
            record = createAfterScheduleRecord(ScheduleId(allocateScheduleId(folded)), paused.prompt, Math.max(1, paused.remainingSeconds), now);
        }
        catch (error) {
            return toInputError(error);
        }
        // 先清 paused：投影 fold 在 append(create) 时读 sidecar；若 create 落地后才
        // removePaused，视图会短暂同时出现「已暂停」+ 新活动行（实测重复行根因）。
        removePaused(sessionId, uid);
        // 保留原 after 窗口：日志 afterSeconds 只是 remaining，进度条需要原窗口才能接着跑
        recordOwnership(sessionId, record.id, paused.delivery, uid, paused.originalAfterSeconds ?? paused.remainingSeconds);
        try {
            agent.session.append('schedule/change', {
                version: 1,
                operation: 'create',
                schedule: record,
            });
        }
        catch {
            removeOwnership(sessionId, record.id);
            recordPaused(sessionId, paused);
            return internalError();
        }
        if (!(await flushSession(ctx, agent.session))) {
            removeOwnership(sessionId, record.id);
            recordPaused(sessionId, paused);
            return persistenceError();
        }
        return {
            ok: true,
            uid,
            schedule_id: record.id,
            remaining_seconds: Math.max(1, paused.remainingSeconds),
        };
    });
}
/** 测试/投影辅助：某会话全部暂停留档。 */
export function listPausedForSession(sessionId) {
    return allPaused(sessionId);
}
/** 测试辅助：按 pause 前 schedule id 查留档。 */
export function findPausedEntry(sessionId, scheduleId) {
    return findPausedByScheduleId(sessionId, scheduleId);
}
