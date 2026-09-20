/**
 * 进度条几何：活动 ↔ 暂停 ↔ 恢复 的条长必须连续、自洽。
 *
 * 锁死的历史缺陷：
 *  1. 冻结比由 `remaining_seconds`（整数秒、ceil）反推 → 非整秒暂停变长；
 *  2. 冻结帧直接用宿主 `paused_at`（比点击晚）→ 暂停瞬间跳增；
 *  3. 冻结帧用 `scheduled_at` 反推 → 暂停后该字段换成 originalScheduledAt，
 *     窗口基准跳变，条长剧烈塌缩（实测 25.7% → 3.3%）；
 *  4. 冻结上界随时间前进 → 条越缩越短（实测 29% → 2.9%）。
 *
 * 现模型：冻结比 = (窗口 - 剩余) / 窗口，纯算术、不依赖会变义的 scheduled_at。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barSegments, frozenBarSegments, barWindow, BAR_UNIT_MS } from '../lib/bar-geometry.js';

const firstSeen = new Map();
const t0 = 1_700_000_000_000;

/** 活动中的 after 任务（2 分钟窗口）。 */
function activeAfter(scheduledAtMs, windowSec = 120) {
  return {
    id: 'u1',
    kind: 'after',
    scheduled_at: new Date(scheduledAtMs).toISOString(),
    after_seconds: windowSec,
    window_seconds: windowSec,
  };
}

/** 暂停后的 wire 形状：scheduled_at 换成 originalScheduledAt，window 仍是原窗口。 */
function pausedAfter(originalScheduledAtMs, windowSec, remainingSec, pausedAtMs, id = 'u1') {
  return {
    id,
    kind: 'after',
    scheduled_at: new Date(originalScheduledAtMs).toISOString(),
    after_seconds: windowSec,
    window_seconds: windowSec,
    paused_at: new Date(pausedAtMs).toISOString(),
    remaining_seconds: remainingSec,
  };
}

test('冻结比 = (窗口 - 剩余) / 窗口，与 scheduled_at 无关（核心回归 3）', () => {
  // 同一 remaining，但 scheduled_at 分别用「原目标」和「某个完全不同的时刻」
  const remainingMs = 84_000; // 已过 36s / 120s = 30%
  const a = pausedAfter(t0 + 120_000, 120, 84, t0 + 36_000);
  const b = { ...a, scheduled_at: new Date(t0 + 999_999).toISOString() };
  const ra = frozenBarSegments(a, remainingMs, firstSeen).totalRatio;
  const rb = frozenBarSegments(b, remainingMs, firstSeen).totalRatio;
  assert.ok(Math.abs(ra - 0.3) < 1e-9, `应为 30%，实际 ${(ra * 100).toFixed(2)}%`);
  assert.equal(rb, ra, 'scheduled_at 改变不得影响冻结比（否则暂停瞬间塌缩）');
});

test('暂停瞬间不跳增：paused_at 比点击晚时钳回点击前进度（回归 2）', () => {
  const windowSec = 120;
  const clickAt = t0 + 36_000;
  const pausedAt = clickAt + 500; // 命令往返 500ms
  const remainingMs = (windowSec * 1000) - (pausedAt - t0);
  const item = pausedAfter(t0 + windowSec * 1000, windowSec, remainingMs / 1000, pausedAt);
  const withClamp = frozenBarSegments(item, remainingMs, firstSeen, clickAt).totalRatio;
  const without = frozenBarSegments(item, remainingMs, firstSeen).totalRatio;
  assert.ok(Math.abs(withClamp - 0.3) < 1e-9, `钳制后应回到 30%，实际 ${(withClamp * 100).toFixed(2)}%`);
  assert.ok(without > withClamp, '未钳制时会多走一截（这正是用户看到跳增的原因）');
});

test('冻结比不随时间漂移（回归 4）', () => {
  const item = pausedAfter(t0 + 120_000, 120, 80, t0 + 40_000);
  const a = frozenBarSegments(item, 80_000, firstSeen).totalRatio;
  const b = frozenBarSegments(item, 80_000, firstSeen).totalRatio;
  assert.equal(a, b);
  assert.ok(Math.abs(a - 1 / 3) < 1e-9, `应为 33.3%，实际 ${(a * 100).toFixed(2)}%`);
});

test('剩余秒用 ceil 造成的取整差不超过 1 秒（回归 1）', () => {
  const windowSec = 120;
  const pausedAt = t0 + 36_400; // 非整秒
  const trueLeftMs = windowSec * 1000 - (pausedAt - t0); // 83600
  const ceilLeftSec = Math.ceil(trueLeftMs / 1000); // 84
  const item = pausedAfter(t0 + windowSec * 1000, windowSec, ceilLeftSec, pausedAt);
  const ratio = frozenBarSegments(item, ceilLeftSec * 1000, firstSeen).totalRatio;
  // 36.4s/120s = 30.33%；用 ceil(83.6)=84s → 30.0%，差 0.33pt（<1s 的取整）
  assert.ok(Math.abs(ratio - 0.30) < 1e-9);
  assert.ok(Math.abs(ratio - 36_400 / 120_000) < 0.01, '取整误差应在 1 秒（≈0.83pt）内');
});

test('恢复后从冻结处继续（进度不回退、不从 0 重跑）', () => {
  const windowSec = 120;
  // 暂停时已过 40s（33.3%）
  const pausedRatio = frozenBarSegments(
    pausedAfter(t0 + windowSec * 1000, windowSec, 80, t0 + 40_000),
    80_000,
    firstSeen,
  ).totalRatio;
  assert.ok(Math.abs(pausedRatio - 1 / 3) < 1e-9);

  // resume：宿主以 after_seconds=remaining 重建，scheduled_at = now + remaining，
  // window_seconds 仍是原窗口 → 进度接着走
  const resumedAt = t0 + 43_000;
  const resumed = activeAfter(resumedAt + 80_000, windowSec);
  const justAfter = barSegments(resumed, resumedAt, firstSeen).totalRatio;
  assert.ok(Math.abs(justAfter - 1 / 3) < 1e-9, `恢复应从 33.3% 继续，实际 ${(justAfter * 100).toFixed(2)}%`);
  // 再走 10s → 41.7%
  const later = barSegments(resumed, resumedAt + 10_000, firstSeen).totalRatio;
  assert.ok(Math.abs(later - (120 - 70) / 120) < 1e-9);
  assert.ok(later > justAfter, '恢复后应单调前进');
});

test('脏数据不越界：剩余 > 窗口 或为负都被钳住', () => {
  const item = pausedAfter(t0 + 120_000, 120, 0, t0);
  assert.equal(frozenBarSegments({ ...item, remaining_seconds: 999 }, 999_000, firstSeen).totalRatio, 0);
  assert.equal(frozenBarSegments({ ...item, remaining_seconds: -5 }, -5_000, firstSeen).totalRatio, 1);
});

test('barWindow：after 用 window_seconds 反推起点，总时长等于原窗口', () => {
  const scheduledAt = t0 + 60_000;
  const item = activeAfter(scheduledAt, 300);
  const { start, totalMs } = barWindow(item, scheduledAt, t0, firstSeen);
  assert.equal(totalMs, 300_000);
  assert.equal(start, scheduledAt - 300_000);
});

test('count：管数随时长增长，最少 1 段', () => {
  assert.equal(barSegments(activeAfter(t0 + 60_000, 60), t0, firstSeen).count, 1);
  assert.equal(
    barSegments(activeAfter(t0 + 7_200_000, 7_200), t0, firstSeen).count,
    Math.ceil(7_200_000 / BAR_UNIT_MS),
  );
});
