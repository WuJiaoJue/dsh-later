/**
 * 上游跨代兼容矩阵护栏。
 *
 * 锁两件事：
 *  1. Session API 双轨探测（0.1.1 events/seedLength ↔ 0.1.2 ownEvents/inheritedEventCount）
 *     在 foldUserState / read* 上行为一致，且 seedLength 回退不再缺失。
 *  2. package.json peer 枚举与 src/upstream-compat.ts 的 KERNEL_GENERATIONS 同步
 *     ——新 rc 只改一处后跑 scripts/sync-peer-matrix.mjs，这里挡住漏同步。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAfterScheduleRecord } from '@deepseek-ai/dsh-schedule';
import {
  KERNEL_GENERATIONS,
  KERNEL_SCOPED_PACKAGES,
  detectSessionApi,
  peerMatrixEntries,
  peerRangeFor,
  readInheritedEventCount,
  readOwnEvents,
} from '../lib/upstream-compat.js';
import { foldUserState } from '../lib/user-tools.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 0.1.1 形状：.events 数组 + header.seedLength（无 ownEvents / inheritedEventCount）。 */
function legacySession(events, seedLength = 0) {
  return {
    header: { id: 'session-legacy', seedLength },
    events,
    append(type, data) {
      this.events.push({ type, data, seq: this.events.length, time: Date.now() });
    },
  };
}

/** 0.1.2 形状：ownEvents() + inheritedEventCount。 */
function modernSession(events, inheritedEventCount = 0) {
  const log = [...events];
  return {
    header: { id: 'session-modern' },
    inheritedEventCount,
    ownEvents() {
      return log;
    },
    append(type, data) {
      log.push({ type, data, seq: log.length, time: Date.now() });
    },
  };
}

/** 合法 schedule/change create 事件（严格解码：荷载仅 version/operation/schedule）。 */
function createChangeEvent(id) {
  const now = Date.now();
  const schedule = createAfterScheduleRecord(id, 'x', 3600, now);
  return {
    type: 'schedule/change',
    seq: 0,
    time: 0,
    data: { version: 1, operation: 'create', schedule },
  };
}

test('KERNEL_GENERATIONS 覆盖已验证两代，sessionApi 标注正确', () => {
  assert.equal(KERNEL_GENERATIONS.length, 2);
  assert.equal(KERNEL_GENERATIONS[0].id, '0.1.1-rc.2');
  assert.equal(KERNEL_GENERATIONS[0].sessionApi, 'legacy-events');
  assert.equal(KERNEL_GENERATIONS[1].id, '0.1.2-rc.1');
  assert.equal(KERNEL_GENERATIONS[1].sessionApi, 'own-events');
});

test('peerRangeFor：commands 额外并上 0.0.1-rc.1，其余仅内核代次', () => {
  assert.equal(
    peerRangeFor('@deepseek-ai/dsh-commands'),
    '^0.0.1-rc.1 || ^0.1.1-rc.2 || ^0.1.2-rc.1',
  );
  assert.equal(peerRangeFor('@deepseek-ai/dsh-session'), '^0.1.1-rc.2 || ^0.1.2-rc.1');
});

test('package.json peer/dev 与 KERNEL_GENERATIONS 矩阵一致', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const { packageName, range } of peerMatrixEntries()) {
    assert.equal(
      pkg.peerDependencies?.[packageName],
      range,
      `peerDependencies.${packageName} 与 KERNEL_GENERATIONS 不同步——改 upstream-compat 后跑 scripts/sync-peer-matrix.mjs`,
    );
    assert.equal(
      pkg.devDependencies?.[packageName],
      range,
      `devDependencies.${packageName} 与 KERNEL_GENERATIONS 不同步`,
    );
  }
  for (const name of KERNEL_SCOPED_PACKAGES) {
    assert.ok(name.startsWith('@deepseek-ai/'), name);
  }
});

test('readOwnEvents：legacy 读 .events，modern 优先 ownEvents()', () => {
  const events = [createChangeEvent('schedule-1')];
  const a = legacySession(events);
  // modernSession 内部拷贝 log，引用身份不同——断言 deepEqual + 长度
  const b = modernSession(events);
  assert.equal(readOwnEvents(a), events);
  assert.deepEqual(readOwnEvents(b), events);
  assert.equal(readOwnEvents(b).length, 1);
  assert.equal(detectSessionApi(a), 'legacy-events');
  assert.equal(detectSessionApi(b), 'own-events');
});

test('readInheritedEventCount：modern 字段优先，legacy 回退 header.seedLength', () => {
  const events = [createChangeEvent('schedule-1'), createChangeEvent('schedule-2')];
  assert.equal(
    readInheritedEventCount({
      header: { seedLength: 99 },
      inheritedEventCount: 1,
    }),
    1,
  );
  // legacy：只有 seedLength（此前实现漏回退 → 恒 0）
  assert.equal(readInheritedEventCount(legacySession(events, 2)), 2);
  assert.equal(readInheritedEventCount({}), 0);
  assert.equal(readInheritedEventCount(legacySession(events, 0)), 0);
  assert.equal(readInheritedEventCount(modernSession(events, 0)), 0);
});

test('readInheritedEventCount：拒绝非 safe integer / 负数，回落下一档', () => {
  assert.equal(readInheritedEventCount({ inheritedEventCount: -1 }), 0);
  assert.equal(readInheritedEventCount({ inheritedEventCount: 1.5 }), 0);
  assert.equal(
    readInheritedEventCount({ inheritedEventCount: -1, header: { seedLength: 3 } }),
    3,
  );
});

test('foldUserState：两代形状对同一 live 日志 fold 结果一致', () => {
  const seedPayload = createChangeEvent('schedule-seed');
  const livePayload = createChangeEvent('schedule-live');

  const modern = modernSession([livePayload], 0);
  const modernState = foldUserState(modern);

  const legacy = legacySession([seedPayload, livePayload], 1);
  const legacyState = foldUserState(legacy);

  const ids = (state) => state.folded.active.map((r) => r.id).sort();
  assert.deepEqual(ids(modernState), ['schedule-live']);
  assert.deepEqual(ids(legacyState), ['schedule-live'], 'seedLength 切片必须排除继承前缀');
});

test('foldUserState：legacy 仅含 seed 时 active 为空（回归：seedLength 曾恒 0）', () => {
  const seedPayload = createChangeEvent('schedule-inherited');
  const session = legacySession([seedPayload], 1);
  const state = foldUserState(session);
  assert.deepEqual(state.folded.active, [], '继承前缀必须被排除');
});
