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
import { readFileSync, writeFileSync } from 'node:fs';
import { resetCacheForTests } from '../lib/ownership-store.js';

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
    await new Promise((resolve) => setTimeout(resolve, 1200));
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

/**
 * 客户端按 `deleted` 决定是否回滚乐观摘除，因此「受理」与「真的删了」必须可区分：
 * 删除一个已经不在（或不存在）的 uid 仍返回 ok:true，但必须 deleted:false。
 * 若这里退化成「找不到也删成功」，UI 就会把一条仍存在的暂停提醒永久藏起来。
 */
test('delete 幂等语义：重复删除同一 uid 返回 deleted:false 而非静默成功', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '重复删除', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;

  const first = await userScheduleDelete(p.uid, agent, fakeCtx);
  assert.equal(first.deleted, true, '首次删除应真的删掉');

  const second = await userScheduleDelete(p.uid, agent, fakeCtx);
  assert.equal(second.ok, true, '重复删除不报错（幂等）');
  assert.equal(second.deleted, false, '第二次什么都没删 → deleted:false');
  assert.equal(second.code, 'schedule_not_found');

  // 完全不存在的 id 同理
  const ghost = await userScheduleDelete('00000000-0000-4000-8000-000000000000', agent, fakeCtx);
  assert.equal(ghost.ok, true);
  assert.equal(ghost.deleted, false);
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

/**
 * 约束：**不能**为「删除暂停项」补写 `schedule/change` delete 事件。
 *
 * dsh-schedule 的 fold 要求 delete 命中仍 active 的 id，而暂停项的日志 id 在
 * pause 时已被删除。补写会抛 `schedule delete targets inactive id`，使整份
 * 日志读失败（GUI 表现为历史加载失败）。此测试守住「删除暂停项不写事件」。
 */
test('约束：删除暂停项不写会话事件（补写 delete 会读坏日志）', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '别写事件', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;

  const before = agent.session.events.length;
  const del = await userScheduleDelete(p.uid, agent, fakeCtx);
  assert.equal(del.deleted, true);
  assert.equal(
    agent.session.events.length,
    before,
    '删除暂停项只清 sidecar；补写 delete 事件会让 dsh-schedule fold 抛错',
  );

  // 日志仍可被上游 fold（整份可读）
  const folded = foldScheduleEvents(agent.session.events);
  assert.deepEqual(folded.active, []);

  // 从日志重放时投影会重读 sidecar → 结果正确（无残留行）。
  // ⚠️ 但**运行时**的投影 cell 只在事件到达时推进，sidecar 变化不会触发重算，
  // 所以线上那份 cell 会一直留着 paused 行；这正是客户端必须自行摘除的原因。
  let state = initUserScheduleProjection(agent.session.header);
  for (const event of agent.session.events) state = applyUserScheduleProjection(state, event);
  const view = viewUserScheduleProjection(state);
  assert.equal(
    view.schedules.length,
    0,
    '重放日志（apply 会重读 sidecar）应得到干净结果',
  );
  assert.equal(getPaused(agent.session.header.id, p.uid), undefined, 'sidecar 已清');
});

/**
 * 约束：暂停项删除后，**同一 uid** 被 resume 时必须能重新看到 active 行。
 * （客户端摘除集合按 uid 粘性存在，这里是它必须解除的依据。）
 */
test('约束：删除暂停项后同 uid resume，投影出现 active 行', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '删了再恢复', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;
  await userScheduleDelete(p.uid, agent, fakeCtx);
  // 删除后 paused 已清，resume 会报 not_paused（无法复活）——这是既有语义
  const resumed = await userScheduleResume(p.uid, agent, fakeCtx);
  assert.equal(resumed.ok, false);
  assert.equal(resumed.code, 'not_paused');
});

/**
 * 回归（根因）：view 必须以 sidecar 为准重读 paused，不能信任可能陈旧的
 * `state.paused` 镜像。
 *
 * 线上表现：删除暂停项后行不消失，且**刷新页面也还在**——因为宿主把陈旧的
 * `paused[]` 持久化进 projection cache（projcache）并按 seq 重新下发，而客户端
 * 按「更高 seq 胜」消费控制帧，删除不产生新事件 → 永远收不到修正帧。
 *
 * 这里直接构造「state.paused 陈旧 + sidecar 已清」的场景，断言 view 不残留。
 */
test('回归：state.paused 陈旧时，view 以 sidecar 为准（删除暂停项可见生效）', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '陈旧镜像', after_seconds: 600, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p.ok);
  if (!p.ok) return;

  await userScheduleDelete(p.uid, agent, fakeCtx);

  // 模拟线上的陈旧 cell：sidecar 已清，但 state.paused 还留着旧镜像
  const stale = {
    sessionId: agent.session.header.id,
    owned: [],
    active: [],
    seedSeq: -1,
    paused: [
      {
        uid: p.uid,
        prompt: '陈旧镜像',
        delivery: 'context',
        kind: 'after',
        remainingSeconds: 100,
        originalScheduledAt: new Date(Date.now() + 600_000).toISOString(),
        lastScheduleId: p.schedule_id,
        pausedAt: Date.now(),
      },
    ],
  };
  const view = viewUserScheduleProjection(stale);
  assert.equal(
    view.schedules.length,
    0,
    'view 必须按 sidecar 重读：陈旧 paused 镜像不得让已删除的行复活',
  );
});

/**
 * 回归：反复「恢复 → 再暂停」不得让进度条窗口缩水。
 *
 * resume 用 `after_seconds = remaining` 重建日志记录，原窗口另存
 * ownership.windowSeconds。若 pause 从日志的 afterSeconds 取窗口，
 * 每轮都会把窗口记成「当次剩余」，窗口越缩越小，
 * 进度条比例随之失真（实测 2 分钟任务暂停后比例从 29% 塌到 2.3%）。
 */
test('回归：resume→再暂停 后 originalAfterSeconds 仍是原窗口', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: '窗口守恒', after_seconds: 120, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const sessionId = agent.session.header.id;

  // 第 1 次暂停：窗口 = 120
  const p1 = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p1.ok);
  if (!p1.ok) return;
  assert.equal(getPaused(sessionId, p1.uid)?.originalAfterSeconds, 120);

  // 恢复：日志 after_seconds 变成「当次剩余」，原窗口只存在于 ownership.windowSeconds。
  const r1 = await userScheduleResume(p1.uid, agent, fakeCtx);
  assert.ok(r1.ok);
  if (!r1.ok) return;

  // 直接改 sidecar 制造「日志 after_seconds < 原窗口」这一真实条件
  //（等价于恢复后又过了一段时间），避免依赖 sleep 的取整时机导致 flaky。
  const file = `${process.env.DSH_LATER_STATE_DIR}/${sessionId.replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  raw.entries[r1.schedule_id].windowSeconds = 120; // 原窗口保留
  writeFileSync(file, JSON.stringify(raw));
  resetCacheForTests();
  // 让日志记录呈现「恢复后已过 90s」的形状：afterSeconds 远小于原窗口。
  // 记录是 Object.freeze 的，故替换整条事件而非原地改字段。
  const idx = agent.session.events.findIndex(
    (e) => e.data?.operation === 'create' && e.data.schedule?.id === r1.schedule_id,
  );
  assert.ok(idx >= 0, '应能找到恢复产生的 create 事件');
  const ev = agent.session.events[idx];
  agent.session.events[idx] = {
    ...ev,
    data: { ...ev.data, schedule: { ...ev.data.schedule, afterSeconds: 30 } },
  };

  const p2 = await userSchedulePause(r1.schedule_id, agent, fakeCtx);
  assert.ok(p2.ok);
  if (!p2.ok) return;
  assert.equal(
    getPaused(sessionId, p2.uid)?.originalAfterSeconds,
    120,
    '窗口必须取自 ownership（120），不得用日志 afterSeconds（30）导致缩水',
  );
});

test('投影 wire：暂停行的 window_seconds 恒为原窗口（供进度条使用）', async () => {
  freshOwnershipDir();
  const agent = fakeAgent();
  const created = await userScheduleCreate(
    { prompt: 'wire 窗口', after_seconds: 120, time_zone: 'Asia/Shanghai' },
    agent,
    fakeCtx,
  );
  assert.ok(created.ok);
  if (!created.ok) return;
  const p1 = await userSchedulePause(created.id, agent, fakeCtx);
  assert.ok(p1.ok);
  if (!p1.ok) return;
  const r1 = await userScheduleResume(p1.uid, agent, fakeCtx);
  assert.ok(r1.ok);
  if (!r1.ok) return;
  const p2 = await userSchedulePause(r1.schedule_id, agent, fakeCtx);
  assert.ok(p2.ok);
  if (!p2.ok) return;

  let state = initUserScheduleProjection(agent.session.header);
  for (const event of agent.session.events) state = applyUserScheduleProjection(state, event);
  const paused = viewUserScheduleProjection(state).schedules.filter((s) => s.status === 'paused');
  assert.equal(paused.length, 1);
  assert.equal(paused[0]?.window_seconds, 120, 'wire 必须给出原窗口，进度条据此算比例');
  assert.equal(paused[0]?.id, p2.uid);
});
