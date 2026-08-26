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
  userScheduleList,
} from '../lib/user-tools.js';
import { OWNED_EVENT } from '../lib/domain.js';

/** 极简假 Session：支持 events/header/append。 */
class FakeSession {
  constructor(seedLength = 0, seedEvents = []) {
    this.header = { seedLength };
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

  // 事件数量：schedule/change + owned
  const changes = agent.session.events.filter((e) => e.type === 'schedule/change');
  const owned = agent.session.events.filter((e) => e.type === OWNED_EVENT);
  assert.equal(changes.length, 1);
  assert.equal(owned.length, 1);
  assert.equal(owned[0].data.operation, 'add');
  assert.equal(owned[0].data.id, result.id);

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
