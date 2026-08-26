/**
 * 用户调度器 runtime 测试：决策纯函数 + 假 agent 下的触发/去重/重驱。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueUserDecision, UserScheduleRuntime } from '../lib/runtime.js';
import { foldScheduleEvents } from '@deepseek-ai/dsh-schedule';

const S = (over = {}) => ({
  id: 's1',
  kind: 'after',
  prompt: 'p',
  afterSeconds: 60,
  scheduledAt: '2999-01-01T08:00:00.000Z',
  ...over,
});

/** 干净的 at 记录（无多余字段，可通过 dsh-schedule 严格解码）。 */
const S_AT = (id, scheduledAt) => ({
  id,
  kind: 'at',
  prompt: 'p',
  scheduledAt,
});

test('决策：无到期 → wait 返回下一个目标', () => {
  const now = Date.parse('2099-01-01T00:00:00.000Z');
  const d = dueUserDecision([S()], now);
  assert.equal(d.kind, 'wait');
  if (d.kind === 'wait') assert.equal(d.target, Date.parse('2999-01-01T08:00:00.000Z'));
});

test('决策：到期一次性 → one-shot', () => {
  const now = Date.parse('2999-01-01T09:00:00.000Z');
  const d = dueUserDecision([S({ id: 'a', scheduledAt: '2999-01-01T08:30:00.000Z' }), S({ id: 'b', scheduledAt: '2999-01-01T08:00:00.000Z' })], now);
  assert.equal(d.kind, 'one-shot');
  if (d.kind === 'one-shot') assert.equal(d.record.id, 'b'); // 最早到期优先
});

test('决策：到期固定间隔 → every 批次', () => {
  const now = Date.parse('2999-01-01T09:00:00.000Z');
  const d = dueUserDecision(
    [S({ id: 'e', kind: 'every', everySeconds: 300, scheduledAt: '2999-01-01T08:00:00.000Z' })],
    now,
  );
  assert.equal(d.kind, 'every');
  if (d.kind === 'every') {
    assert.equal(d.reminders.length, 1);
    assert.equal(d.reminders[0].record.id, 'e');
    assert.equal(d.reminders[0].occurrenceAt, '2999-01-01T09:00:00.000Z');
  }
});

/** 假 Session（支持 events/header/append）。 */
class FakeSession {
  constructor(seed = []) {
    this.header = { seedLength: 0 };
    this.events = seed;
  }
  append(type, data) {
    const seq = this.events.length;
    this.events.push({ type, seq, time: Date.now(), data });
  }
}

/** 假 Agent：message 收集 + 简易 runMaintenance/whenIdle。 */
class FakeAgent {
  constructor(session) {
    this.id = 'agent-runtime';
    this.session = session;
    this.messages = [];
    this.busy = false;
  }
  followup(message) {
    this.messages.push(message);
  }
  async whenIdle() {}
  async runMaintenance(job) {
    if (this.busy) throw new Error('agent already has active work');
    this.busy = true;
    try {
      return await job();
    } finally {
      this.busy = false;
    }
  }
}

function fakeCtx(agent) {
  return {
    sessions: { flush: async () => true },
    agents: { get: () => agent, roots: () => [agent] },
    logger: { warn: () => undefined },
  };
}

test('runtime：到期一次性提醒被派发并注入用户消息', async () => {
  const target = Date.now() + 300;
  const record = S_AT('s1', new Date(target).toISOString());
  const session = new FakeSession([
    {
      type: 'schedule/change',
      seq: 0,
      time: 0,
      data: { version: 1, operation: 'create', schedule: record },
    },
    {
      type: 'session-scheduler/user-schedule',
      seq: 1,
      time: 0,
      data: { version: 1, operation: 'add', id: 's1' },
    },
  ]);
  const agent = new FakeAgent(session);
  const runtime = new UserScheduleRuntime(fakeCtx(agent), agent);
  runtime.requestDrive();
  // 等待目标时间 + 派发余量
  await new Promise((r) => setTimeout(r, target - Date.now() + 800));
  await runtime.dispose();

  assert.equal(agent.messages.length, 1);
  assert.match(agent.messages[0].content[0].text, /\[SCHEDULE REMINDER\]/);
  const dispatch = session.events.filter((e) => e.type === 'schedule/change' && e.data.operation === 'dispatch');
  assert.equal(dispatch.length, 1);
  // 已派发后 fold 里不再活动（与 dsh-schedule 一致 → 不会双触发）
  const folded = foldScheduleEvents(session.events, 0);
  assert.equal(folded.active.length, 0);
});

test('runtime：nothing 到期时不注入、不写 dispatch', async () => {
  const session = new FakeSession([
    {
      type: 'schedule/change',
      seq: 0,
      time: 0,
      data: {
        version: 1,
        operation: 'create',
        schedule: S({ id: 'far', scheduledAt: new Date(Date.now() + 60000).toISOString() }),
      },
    },
    {
      type: 'session-scheduler/user-schedule',
      seq: 1,
      time: 0,
      data: { version: 1, operation: 'add', id: 'far' },
    },
  ]);
  const agent = new FakeAgent(session);
  const runtime = new UserScheduleRuntime(fakeCtx(agent), agent);
  runtime.requestDrive();
  await new Promise((r) => setTimeout(r, 200));
  await runtime.dispose();
  assert.equal(agent.messages.length, 0);
  // 只武装了未来 timer，没有 dispatch
  const dispatch = session.events.filter((e) => e.type === 'schedule/change' && e.data.operation === 'dispatch');
  assert.equal(dispatch.length, 0);
});
