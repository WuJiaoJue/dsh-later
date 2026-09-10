/**
 * 投影单元「注册形状」回归测试。
 *
 * 背景：v1 时代 `userSchedulesProjectionUnit` 用 `{schema}` + 顶层 `view`
 * 声明，与宿主的 `ProjectionDefinition`（rc.2）契约不符 —— 宿主
 * `register()` 要求 `stateSchema` + `wire:{viewSchema,view}`，否则单元被当作
 * host-only（`snapshot()` 第一步 `if (wire === void 0) continue`），客户端
 * `useProjection('userSchedules')` 永远读到 undefined，dock 静默消失。
 * 而 `as never` 让类型检查无法拦截。
 *
 * 本测试从 **运行时** 锁定形状：任何导致「无 wire = 不 client-visible」的
 * 回归都会在这里失败，不依赖 registry 是否装得上 rc.2 类型。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userSchedulesProjectionUnit } from '../lib/projection.js';
import { PROJECTION_KEY } from '../lib/domain.js';

/**
 * 最小化复现宿主 `sessionProjections.register()` 对 client-visible 的判定
 * （dsh-session-projection rc.2 lib/index.js：`wire === void 0 -> continue`）。
 */
function isClientVisible(unit) {
  return unit?.wire?.view !== undefined && unit?.wire?.viewSchema !== undefined;
}

/** 模拟宿主 snapshot()：无 wire 的单元被跳过。 */
function snapshotUnits(units) {
  const values = {};
  for (const unit of units) {
    if (unit.wire === void 0) continue;
    values[unit.key] = unit.wire.view(unit.init());
  }
  return values;
}

test('单元键与声明常量一致', () => {
  assert.equal(userSchedulesProjectionUnit.key, PROJECTION_KEY);
  assert.equal(PROJECTION_KEY, 'userSchedules');
});

test('注册形状符合 rc.2 契约：stateSchema + wire{viewSchema,view} 存在', () => {
  const unit = userSchedulesProjectionUnit;
  assert.equal(typeof unit.stateSchema?.parse, 'function', '必须有 stateSchema（原名 schema 是 rc.1 旧契约）');
  assert.equal(typeof unit.init, 'function');
  assert.equal(typeof unit.apply, 'function');
  assert.ok(Number.isSafeInteger(unit.stateVersion), 'stateVersion 必须是非负整数');
  // wire 视图：client-visible 的充要条件
  assert.ok(isClientVisible(unit), '单元必须带 wire{viewSchema,view} 才算 client-visible');
  assert.equal(typeof unit.wire.viewSchema?.parse, 'function');
  assert.equal(typeof unit.wire.view, 'function');
});

test('宿主 snapshot() 会包含该单元（不再被 wire===undefined 跳过）', () => {
  const values = snapshotUnits([userSchedulesProjectionUnit]);
  assert.ok('userSchedules' in values, 'snapshot 必须携带 userSchedules 键');
  assert.deepEqual(values.userSchedules, { schedules: [] });
});

test('回归护栏：旧形状（顶层 view / schema）不会被当作 client-visible', () => {
  // 旧 bug 版：只有顶层 view + schema，没有 wire
  const oldBugShape = {
    key: 'userSchedules',
    schema: userSchedulesProjectionUnit.stateSchema,
    init: userSchedulesProjectionUnit.init,
    apply: userSchedulesProjectionUnit.apply,
    view: userSchedulesProjectionUnit.wire.view,
    stateVersion: 1,
  };
  assert.equal(isClientVisible(oldBugShape), false, '旧形状必须被判为 NOT client-visible');
  assert.deepEqual(snapshotUnits([oldBugShape]), {}, '宿主 snapshot 必须跳过旧形状');
});

test('wire.view 输出可被 viewSchema 校验通过（schema 往返）', () => {
  const unit = userSchedulesProjectionUnit;
  let state = unit.init();
  // 构造最少事件路径：create + owned
  const mk = (type, data, seq) => ({ type, data, seq, time: 0 });
  const schedule = {
    id: 's1',
    kind: 'after',
    prompt: '测试',
    afterSeconds: 60,
    scheduledAt: '2999-01-01T06:00:00.000Z',
  };
  state = unit.apply(state, mk('schedule/change', { version: 1, operation: 'create', schedule }, 1));
  state = unit.apply(state, mk('session-scheduler/user-schedule', { version: 1, operation: 'add', id: 's1' }, 2));
  const view = unit.wire.view(state);
  const parsed = unit.wire.viewSchema.parse(view); // 抛错即失败
  assert.deepEqual(parsed, view);
  assert.equal(parsed.schedules.length, 1);
});
