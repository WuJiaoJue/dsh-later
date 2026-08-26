/**
 * userSchedules 投影 fold 测试：create/owned/dispatch/delete 与 fork 隔离。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyUserScheduleProjection,
  initUserScheduleProjection,
  viewUserScheduleProjection,
} from '../lib/projection.js';
import { OWNED_EVENT } from '../lib/domain.js';

/** 构造一条 schedule/change create 事件（与 dsh-schedule 完全兼容）。 */
function createEvent(schedule, seq = 0) {
  return {
    type: 'schedule/change',
    seq,
    time: 0,
    data: { version: 1, operation: 'create', schedule },
  };
}

/** 构造一条伴生所有权 add 事件。 */
function ownedEvent(id, seq) {
  return { type: OWNED_EVENT, seq, time: 0, data: { version: 1, operation: 'add', id } };
}

function dispatchEvent(id, seq, acceptedAt) {
  return {
    type: 'schedule/change',
    seq,
    time: 0,
    data:
      acceptedAt === undefined
        ? { version: 1, operation: 'dispatch', id }
        : { version: 1, operation: 'dispatch', id, acceptedAt },
  };
}

function deleteEvent(id, seq) {
  return { type: 'schedule/change', seq, time: 0, data: { version: 1, operation: 'delete', id } };
}

const atSchedule = {
  id: 'schedule-1',
  kind: 'at',
  prompt: '检查构建结果',
  scheduledAt: '2999-01-01T06:00:00.000Z',
};

const everySchedule = {
  id: 'schedule-2',
  kind: 'every',
  prompt: '检查服务状态',
  everySeconds: 300,
  scheduledAt: '2999-01-01T07:00:00.000Z',
};

test('只展示 user-owned 的活动任务', () => {
  let state = initUserScheduleProjection();
  // 用户创建
  state = applyUserScheduleProjection(state, createEvent(atSchedule));
  state = applyUserScheduleProjection(state, ownedEvent('schedule-1', 1));
  // 模型创建（无 owned）
  state = applyUserScheduleProjection(state, createEvent(everySchedule));
  const view = viewUserScheduleProjection(state);
  assert.equal(view.schedules.length, 1);
  assert.equal(view.schedules[0].id, 'schedule-1');
  assert.equal(view.schedules[0].kind, 'at');
  assert.equal(view.schedules[0].scheduled_at, '2999-01-01T06:00:00.000Z');
  assert.equal(view.schedules[0].delivery_mode, 'session-local');
});

test('dispatch 后一次性任务移除、every 推进', () => {
  let state = initUserScheduleProjection();
  state = applyUserScheduleProjection(state, createEvent(atSchedule));
  state = applyUserScheduleProjection(state, ownedEvent('schedule-1', 1));
  // one-shot dispatch（无 acceptedAt）
  state = applyUserScheduleProjection(state, dispatchEvent('schedule-1', 2));
  assert.equal(viewUserScheduleProjection(state).schedules.length, 0);

  state = initUserScheduleProjection();
  state = applyUserScheduleProjection(state, createEvent(everySchedule));
  state = applyUserScheduleProjection(state, ownedEvent('schedule-2', 1));
  // every dispatch（带 acceptedAt）：推进下一次
  const accepted = Date.parse('2999-01-01T08:00:00.000Z');
  state = applyUserScheduleProjection(
    state,
    dispatchEvent('schedule-2', 2, new Date(accepted).toISOString()),
  );
  assert.equal(viewUserScheduleProjection(state).schedules.length, 1);
  // 下一次 = 锚点 07:00 + k*300s，最后 <= accepted 后 +300s
  const target = Date.parse(viewUserScheduleProjection(state).schedules[0].scheduled_at);
  assert.ok(target > accepted);
  assert.equal((target - Date.parse('2999-01-01T07:00:00.000Z')) % (300 * 1000), 0);
});

test('delete 后任务移除', () => {
  let state = initUserScheduleProjection();
  state = applyUserScheduleProjection(state, createEvent(atSchedule));
  state = applyUserScheduleProjection(state, ownedEvent('schedule-1', 1));
  state = applyUserScheduleProjection(state, deleteEvent('schedule-1', 2));
  assert.equal(viewUserScheduleProjection(state).schedules.length, 0);
});

test('fork 隔离：session/end-seed 后不继承父会话任务（AC-07）', () => {
  let state = initUserScheduleProjection();
  let seq = 0;
  // 父会话前缀：已有用户任务
  state = applyUserScheduleProjection(state, createEvent(atSchedule, seq));
  state = applyUserScheduleProjection(state, { ...ownedEvent('schedule-1', ++seq), seq });
  // 派生边界（seq=2）
  state = applyUserScheduleProjection(state, {
    type: 'session/end-seed',
    seq: ++seq,
    time: 0,
    data: {},
  });
  assert.equal(viewUserScheduleProjection(state).schedules.length, 0);
  // 子会话自己新建（seq=3,4）
  const child = { ...atSchedule, id: 'schedule-3' };
  state = applyUserScheduleProjection(state, { ...createEvent(child), seq: ++seq });
  state = applyUserScheduleProjection(state, { ...ownedEvent('schedule-3', ++seq), seq });
  const view = viewUserScheduleProjection(state);
  assert.equal(view.schedules.length, 1);
  assert.equal(view.schedules[0].id, 'schedule-3');
});

test('无关事件返回同一引用（不触发推送）', () => {
  const state = initUserScheduleProjection();
  const unrelated = { type: 'user/message', seq: 0, time: 0, data: {} };
  assert.equal(applyUserScheduleProjection(state, unrelated), state);
});
