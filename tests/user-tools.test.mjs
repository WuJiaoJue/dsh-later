/**
 * user-tools 集成测试：用假 session/ctx 验证 create/list/delete，
 * 并验证写入的 `schedule/change` 事件能被 dsh-schedule 自身的 fold 解码
 * （AC-20 兼容性：与其同时安装互不干扰）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldScheduleEvents } from '@deepseek-ai/dsh-schedule';
import {
  DEFAULT_MAX_SCHEDULES,
  userScheduleCreate,
  userScheduleDelete,
  userScheduleEditPrompt,
  userScheduleList,
} from '../lib/user-tools.js';
import { OWNED_EVENT } from '../lib/domain.js';
import { freshOwnershipDir, markOwnership } from './helpers/ownership-state.mjs';
import { getOwnership, hasOwnership } from '../lib/ownership-store.js';

/** 极简假 Session：支持 events/header/append。 */
let fakeSessionSeq = 0;

class FakeSession {
  constructor(seedLength = 0, seedEvents = []) {
    this.header = { id: `session-test-${++fakeSessionSeq}`, seedLength };
    this.events = seedEvents.map((event, index) => ({ seq: index, time: 0, ...event }));
    this.appended = [];
  }

  append(type, data) {
    const seq = this.events.length;
    const event = { type, seq, time: Date.now(), data };
    this.events.push(event);
    this.appended.push(event);
    return event;
  }
}

/** 假 agent。 */
function fakeAgent(events = []) {
  return { id: 'agent-test', session: new FakeSession(0, events), ctx: {} };
}

/** 假 ctx：flush 恒真。 */
const fakeCtx = {
  sessions: {
    flush: async () => true,
  },
};

const atInput = {
  prompt: '检查构建结果',
  at: { date: '2999-01-01', time: '14:00:00', time_zone: 'Asia/Shanghai' },
  time_zone: 'Asia/Shanghai',
};

test('create 写入与 dsh-schedule 完全兼容的 schedule/change 事件', async () => {
  const agent = fakeAgent();
  const result = await userScheduleCreate(atInput, agent, fakeCtx);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.kind, 'at');
  assert.equal(result.source, 'user-tool');
  assert.equal(result.delivery_mode, 'session-local');
  assert.equal(result.state, 'scheduled');

  // 事件数量：只写 schedule/change（所有权走 sidecar，不再写伴生事件）
  const ownedEvents = agent.session.events.filter((e) => e.type === OWNED_EVENT);
  assert.equal(ownedEvents.length, 0, '不再写入伴生所有权事件');
  assert.equal(hasOwnership(agent.session.header.id, result.id), true);
  const changes = agent.session.events.filter((e) => e.type === 'schedule/change');
  assert.equal(changes.length, 1);

  // dsh-schedule 自身 fold 能解码（无 source 字段 → 不会抛 corrupt）
  const folded = foldScheduleEvents(agent.session.events, 0);
  assert.equal(folded.active.length, 1);
  assert.equal(folded.active[0].id, result.id);
});

test('create after_seconds / every_seconds 分支', async () => {
  const agent1 = fakeAgent();
  const after = await userScheduleCreate(
    { prompt: '10 分钟后', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent1,
    fakeCtx,
  );
  assert.ok(after.ok);
  if (after.ok) assert.equal(after.kind, 'after');

  const agent2 = fakeAgent();
  const every = await userScheduleCreate(
    { prompt: '5 分钟一次', every_seconds: 300, time_zone: 'Asia/Shanghai' },
    agent2,
    fakeCtx,
  );
  assert.ok(every.ok);
  if (every.ok) assert.equal(every.kind, 'every');
});

test('create 校验：空 prompt / 多选 / 非法时区 / 过低频次', async () => {
  const agent = fakeAgent();
  const empty = await userScheduleCreate({ prompt: '   ', after_seconds: 1, time_zone: 'Asia/Shanghai' }, agent, fakeCtx);
  assert.deepEqual({ ...empty }, { ok: false, code: 'invalid_prompt', message: '提醒内容不能为空。' });

  const multi = await userScheduleCreate(
    { prompt: 'x', after_seconds: 600, every_seconds: 300, time_zone: 'Asia/Shanghai' },
    fakeAgent(),
    fakeCtx,
  );
  assert.ok(!multi.ok && multi.code === 'invalid_selector');

  const badTz = await userScheduleCreate(
    { prompt: 'x', after_seconds: 600, time_zone: 'Not/AZone' },
    fakeAgent(),
    fakeCtx,
  );
  assert.ok(!badTz.ok && badTz.code === 'invalid_time_zone');

  const tooFast = await userScheduleCreate(
    { prompt: 'x', every_seconds: 60, time_zone: 'Asia/Shanghai' },
    fakeAgent(),
    fakeCtx,
  );
  assert.ok(!tooFast.ok && tooFast.code === 'frequency_too_high');
});

test('create 过去时间 → not_future', async () => {
  const past = await userScheduleCreate(
    { prompt: 'x', time_zone: 'Asia/Shanghai', at: { date: '2000-01-01', time: '00:00:00', time_zone: 'Asia/Shanghai' } },
    fakeAgent(),
    fakeCtx,
  );
  assert.ok(!past.ok && past.code === 'not_future');
});

test('单 session 上限 quota_exceeded', async () => {
  const agent = fakeAgent();
  // 占满额度（100 条，秒粒度 after 递增保证 id 不重复）
  for (let i = 0; i < DEFAULT_MAX_SCHEDULES; i += 1) {
    const r = await userScheduleCreate(
      { prompt: `t${i}`, after_seconds: 3600 + i, time_zone: 'Asia/Shanghai' },
      agent,
      fakeCtx,
    );
    assert.ok(r.ok);
  }
  const over = await userScheduleCreate(
    { prompt: '超额', after_seconds: 3600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(!over.ok && over.code === 'quota_exceeded');
});

test('list 只返回用户创建的任务，且含状态', async () => {
  const agent = fakeAgent();
  await userScheduleCreate(atInput, agent, fakeCtx);
  const list = await userScheduleList(agent, fakeCtx);
  assert.ok(list.ok);
  if (!list.ok) return;
  assert.equal(list.schedules.length, 1);
  assert.equal(list.schedules[0].prompt, '检查构建结果');
  assert.ok(['scheduled', 'overdue'].includes(list.schedules[0].state));
});

test('delete 删除成功 / 不存在返回 deleted:false', async () => {
  const agent = fakeAgent();
  const created = await userScheduleCreate(atInput, agent, fakeCtx);
  assert.ok(created.ok);
  if (!created.ok) return;
  const del = await userScheduleDelete(created.id, agent, fakeCtx);
  assert.deepEqual({ ...del }, { ok: true, id: created.id, deleted: true });
  // 确认 dsh-schedule fold 中已移除
  assert.equal(foldScheduleEvents(agent.session.events, 0).active.length, 0);

  const missing = await userScheduleDelete('schedule-999', agent, fakeCtx);
  assert.deepEqual({ ...missing }, { ok: true, id: 'schedule-999', deleted: false, code: 'schedule_not_found' });
});

test('永久分配不重复的 id', async () => {
  const agent = fakeAgent();
  await userScheduleCreate(atInput, agent, fakeCtx);
  // 删除后再创建，id 不复用（seenIds 保留）
  await userScheduleDelete('schedule-1', agent, fakeCtx);
  const second = await userScheduleCreate(
    { prompt: 'again', time_zone: 'Asia/Shanghai', at: { date: '2999-01-02', time: '10:00:00', time_zone: 'Asia/Shanghai' } },
    agent,
    fakeCtx,
  );
  assert.ok(second.ok);
  if (second.ok) assert.equal(second.id, 'schedule-2');
});

// ─── P0-1：delivery 信任边界 ───────────────────────────────────────────

test('P0-1：工具/通用通道夹带 delivery:"user" 必须被忽略（安全回归）', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  // 模型在工具参数 / GUI 在面板载荷里夹带 delivery —— 一律无效
  const smuggled = await userScheduleCreate(
    { ...atInput, delivery: 'user' },
    agent,
    fakeCtx,
  );
  assert.ok(smuggled.ok);
  const ownedEvents = agent.session.events.filter((e) => e.type === OWNED_EVENT);
  assert.equal(ownedEvents.length, 0, '不再写入伴生所有权事件');
  assert.equal(getOwnership(agent.session.header.id, smuggled.id)?.delivery, 'context'); // 未获得代发形态
});

test('P0-1：仅可信通道（trustedDelivery）能声明 user 代发形态', async () => {
  const agent = fakeAgent();
  const later = await userScheduleCreate(
    { prompt: '稍后替我说', after_seconds: 600 },
    agent,
    fakeCtx,
    DEFAULT_MAX_SCHEDULES,
    { trustedDelivery: 'user' }, // 只有人类显式输入的 /later 走这里
  );
  assert.ok(later.ok);
  assert.equal(getOwnership(agent.session.header.id, later.id)?.delivery, 'user');
});

// ─── P1-8：时区可选 ──────────────────────────────────────────────────

test('P1-8：time_zone 缺省时用检测时区创建成功', async () => {
  const agent = fakeAgent();
  const result = await userScheduleCreate({ prompt: '不带时区', after_seconds: 600 }, agent, fakeCtx);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.kind, 'after');
    assert.ok(result.scheduled_at.length > 0);
  }
});

// ─── P0-4：过期 at 任务禁止改内容 ─────────────────────────────────────

test('create 的 sidecar 所有权在 flush 失败时回滚', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const failingCtx = { sessions: { flush: async () => false } };
  const result = await userScheduleCreate(
    { prompt: '不会落盘', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    failingCtx,
  );
  assert.ok(!result.ok && result.code === 'persistence_uncertain');
  assert.equal(hasOwnership(agent.session.header.id, result.id), false, 'sidecar 已回滚');
});

test('delete 成功后撤销 sidecar 所有权；flush 失败时保留', async () => {
  freshOwnershipDir();
  const sessionId = 'session-delete-case';
  const agent = fakeAgent();
  agent.session.header.id = sessionId;
  const created = await userScheduleCreate(
    { prompt: '待删', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  assert.equal(hasOwnership(sessionId, created.id), true);
  await userScheduleDelete(created.id, agent, fakeCtx);
  assert.equal(hasOwnership(sessionId, created.id), false);
  // flush 失败：保留所有权（日志可能未落盘，运行时仍需追踪）
  const agent2 = fakeAgent();
  agent2.session.header.id = sessionId;
  const created2 = await userScheduleCreate(
    { prompt: '删除失败', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent2,
    fakeCtx,
  );
  assert.ok(created2.ok);
  const failing = { sessions: { flush: async () => false } };
  await userScheduleDelete(created2.id, agent2, failing);
  assert.equal(hasOwnership(sessionId, created2.id), true, 'flush 失败时保留 sidecar');
});

test('edit 保留投递形态并迁移 sidecar 所有权', async () => {
  freshOwnershipDir();
  const sessionId = 'session-edit-case';
  const agent = fakeAgent();
  agent.session.header.id = sessionId;
  const created = await userScheduleCreate(
    { prompt: '稍后替我说', after_seconds: 600 },
    agent,
    fakeCtx,
    DEFAULT_MAX_SCHEDULES,
    { trustedDelivery: 'user' },
  );
  assert.ok(created.ok);
  const edited = await userScheduleEditPrompt(created.id, '改个说法', agent, fakeCtx);
  assert.ok(edited.ok);
  assert.equal(getOwnership(sessionId, created.id), undefined, '旧 id 所有权已撤销');
  assert.equal(getOwnership(sessionId, edited.id)?.delivery, 'user', '新 id 继承 user 形态');
});

test('P0-4：编辑已过期的 at 任务返回 already_overdue，不产生新事件', async () => {
  const pastRecord = {
    id: 'schedule-past',
    kind: 'at',
    prompt: '旧的',
    scheduledAt: new Date(Date.now() - 60_000).toISOString(),
  };
  const agent = fakeAgent([
    { type: 'schedule/change', data: { version: 1, operation: 'create', schedule: pastRecord } },
    { type: OWNED_EVENT, data: { version: 1, operation: 'add', id: 'schedule-past' } },
  ]);
  const before = agent.session.events.length;
  const edited = await userScheduleEditPrompt('schedule-past', '新内容', agent, fakeCtx);
  assert.ok(!edited.ok && edited.code === 'already_overdue');
  assert.equal(agent.session.events.length, before); // 无任何写入
});
