/**
 * 暂停 / 恢复（仅 after）：方案 B —— sidecar 留档 + 日志 delete/create。
 *
 * 定稿：
 *  - 仅 kind==='after' 且未到点可暂停
 *  - 稳定 uid 在 sidecar；日志 scheduleId 在 resume 后会变（对 UI 不可见）
 *  - 冻结 remainingSeconds；resume 用 after_seconds=remaining 重建
 *  - wire status:'paused' + 原地斜纹进度条（见 styles.ts ss-paused）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldScheduleEvents } from '@deepseek-ai/dsh-schedule';
import {
  userScheduleCreate,
  userScheduleDelete,
  userSchedulePause,
  userScheduleResume,
} from '../lib/user-tools.js';
import {
  getPaused,
  getOwnership,
  findScheduleIdByUid,
} from '../lib/ownership-store.js';
import {
  initUserScheduleProjection,
  applyUserScheduleProjection,
  viewUserScheduleProjection,
} from '../lib/projection.js';
import { freshOwnershipDir } from './helpers/ownership-state.mjs';

let fakeSessionSeq = 0;

class FakeSession {
  constructor(seedLength = 0, seedEvents = []) {
    this.header = { id: `session-pause-${++fakeSessionSeq}`, seedLength };
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

function fakeAgent(session = new FakeSession()) {
  return { id: 'agent-pause', session, ctx: {} };
}

const fakeCtx = {
  sessions: { flush: async () => true },
};

test('pause：仅 after 未到点可暂停；sidecar 留档 + 日志 delete', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '十分钟后看构建', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;

  const paused = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(paused.ok);
  if (!paused.ok) return;
  assert.equal(paused.schedule_id, created.id);
  assert.ok(paused.remaining_seconds > 0 && paused.remaining_seconds <= 600);
  assert.ok(typeof paused.uid === 'string' && paused.uid.length > 0);

  const entry = getPaused(agent.session.header.id, paused.uid);
  assert.ok(entry);
  assert.equal(entry.prompt, '十分钟后看构建');
  assert.equal(entry.lastScheduleId, created.id);

  const folded = foldScheduleEvents(agent.session.events, 0);
  assert.equal(folded.active.length, 0, '日志中应已 delete');

  // 投影：delete 后 paused 出现在 wire
  let state = initUserScheduleProjection(agent.session.header);
  for (const event of agent.session.events) {
    state = applyUserScheduleProjection(state, event);
  }
  const view = viewUserScheduleProjection(state);
  assert.equal(view.schedules.length, 1);
  assert.equal(view.schedules[0].status, 'paused');
  assert.equal(view.schedules[0].id, paused.uid);
  assert.equal(view.schedules[0].prompt, '十分钟后看构建');
});

test('resume：after_seconds=remaining 重建；uid 不变、scheduleId 变', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '开会回来继续', after_seconds: 3600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;

  const resumed = await userScheduleResume(p.uid, agent, fakeCtx);
  assert.ok(resumed.ok);
  if (!resumed.ok) return;
  assert.equal(resumed.uid, p.uid);
  assert.notEqual(resumed.schedule_id, p.schedule_id, '日志 id 必须更换（seenIds）');

  const ownership = getOwnership(agent.session.header.id, resumed.schedule_id);
  assert.equal(ownership?.uid, p.uid);
  assert.equal(findScheduleIdByUid(agent.session.header.id, p.uid), resumed.schedule_id);
  assert.equal(getPaused(agent.session.header.id, p.uid), undefined, 'resume 后 paused 清除');

  const folded = foldScheduleEvents(agent.session.events, 0);
  assert.equal(folded.active.length, 1);
  assert.equal(folded.active[0].id, resumed.schedule_id);
  assert.equal(folded.active[0].kind, 'after');
});

test('pause 拒绝：every / at / 已到点 / 不存在', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();

  const every = await userScheduleCreate(
    { prompt: '每5分钟', every_seconds: 300, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(every.ok);
  if (every.ok) {
    const r = await userSchedulePause(every.id, agent, fakeCtx);
    assert.ok(!r.ok && r.code === 'unsupported_kind');
    await userScheduleDelete(every.id, agent, fakeCtx);
  }

  const at = await userScheduleCreate(
    { prompt: '明天', at: { date: '2999-01-01', time: '10:00:00', time_zone: 'Asia/Shanghai' }, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(at.ok);
  if (at.ok) {
    const r = await userSchedulePause(at.id, agent, fakeCtx);
    assert.ok(!r.ok && r.code === 'unsupported_kind');
  }

  // 已到点 after
  const dueAgent = fakeAgent(new FakeSession(0, []));
  const due = await userScheduleCreate(
    { prompt: '马上', after_seconds: 1, time_zone: 'Asia/Shanghai' },
    dueAgent,
    fakeCtx,
  );
  assert.ok(due.ok);
  if (due.ok) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const r = await userSchedulePause(due.id, dueAgent, fakeCtx);
    assert.ok(!r.ok && r.code === 'already_overdue');
  }

  const missing = await userSchedulePause('schedule-999', agent, fakeCtx);
  assert.ok(!missing.ok && missing.code === 'schedule_not_found');
});

test('resume 拒绝：未暂停 uid', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const r = await userScheduleResume('uid-nope', agent, fakeCtx);
  assert.ok(!r.ok && r.code === 'not_paused');
});

test('resume 后投影不残留 paused（双行回归）', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '双行回归', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;
  const resumed = await userScheduleResume(p.uid, agent, fakeCtx);
  assert.ok(resumed.ok);

  let state = initUserScheduleProjection(agent.session.header);
  for (const event of agent.session.events) {
    state = applyUserScheduleProjection(state, event);
  }
  const view = viewUserScheduleProjection(state);
  const pausedRows = view.schedules.filter((s) => s.status === 'paused');
  const activeRows = view.schedules.filter((s) => s.status !== 'paused');
  assert.equal(pausedRows.length, 0, 'resume 后不得残留 paused 行');
  assert.equal(activeRows.length, 1);
  assert.equal(activeRows[0].id, p.uid, 'wire id 应为稳定 uid');
  // resume 后：日志 afterSeconds=remaining，但 window_seconds 仍是原 after 间隔
  assert.equal(activeRows[0].window_seconds, 600, 'window_seconds 保留原 after 间隔');
  assert.ok(
    (activeRows[0].after_seconds ?? 0) <= 600,
    'after_seconds 为 remaining（≤ 原窗口）',
  );
});

test('delete 支持 uid：活动任务与暂停项', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '可删', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const ownership = getOwnership(agent.session.header.id, created.id);
  assert.ok(ownership?.uid);
  const delActive = await userScheduleDelete(ownership.uid, agent, fakeCtx);
  assert.ok(delActive.ok && delActive.deleted === true);

  const created2 = await userScheduleCreate(
    { prompt: '暂停后删', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created2.ok);
  if (!created2.ok) return;
  const p = await userSchedulePause(created2.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;
  const delPaused = await userScheduleDelete(p.uid, agent, fakeCtx);
  assert.ok(delPaused.ok && delPaused.deleted === true);
  assert.equal(getPaused(agent.session.header.id, p.uid), undefined);
});

test('投影 stateVersion 为 4 且 wire 带 status', async () => {
  freshOwnershipDir();
  const { userSchedulesProjectionUnit } = await import('../lib/projection.js');
  assert.equal(userSchedulesProjectionUnit.stateVersion, 4);
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: 'x', after_seconds: 120, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  let state = initUserScheduleProjection(agent.session.header);
  for (const event of agent.session.events) {
    state = applyUserScheduleProjection(state, event);
  }
  const view = viewUserScheduleProjection(state);
  assert.equal(view.schedules[0]?.status, 'active');
  // create 已写 uid → wire id 为稳定 uid
  const ownership = getOwnership(agent.session.header.id, created.id);
  assert.ok(ownership?.uid);
  assert.equal(view.schedules[0]?.id, ownership.uid);
});
