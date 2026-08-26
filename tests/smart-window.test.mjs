/**
 * smart-window 智能时段纯函数测试。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SMART_WINDOW,
  MINUTE_MS,
  SMART_MIN_DELAY_MS,
  epochFromLocal,
  floorToMinute,
  hhmmToMinutes,
  isValidWindow,
  localFieldsOf,
  minutesToHhmm,
  nextSmartAt,
  nextSmartTarget,
} from '../lib/smart-window.js';

const TZ = 'Asia/Shanghai';

test('hhmmToMinutes / minutesToHhmm 往返', () => {
  assert.equal(hhmmToMinutes('09:00'), 540);
  assert.equal(hhmmToMinutes('23:59'), 1439);
  assert.equal(hhmmToMinutes('24:00'), undefined);
  assert.equal(hhmmToMinutes('9:00'), undefined);
  assert.equal(minutesToHhmm(540), '09:00');
  assert.equal(minutesToHhmm(0), '00:00');
});

test('isValidWindow 默认配置合法', () => {
  assert.equal(isValidWindow(DEFAULT_SMART_WINDOW), true);
  assert.equal(isValidWindow({ ...DEFAULT_SMART_WINDOW, workStart: '12:00' }), false);
  assert.equal(isValidWindow({ ...DEFAULT_SMART_WINDOW, lunchEnd: '25:00' }), false);
});

test('本地墙钟解析（Asia/Shanghai，无 DST）', () => {
  // 2026-08-19 14:00 Asia/Shanghai = 2026-08-19T06:00:00Z
  const epoch = epochFromLocal('2026-08-19', '14:00', TZ);
  assert.ok(epoch !== undefined);
  assert.equal(new Date(epoch).toISOString(), '2026-08-19T06:00:00.000Z');
});

test('nextSmartTarget 工作时段内 → 下一窗口起点（至少 2 分钟后）', () => {
  // 2026-08-19 15:00 Asia/Shanghai（工作时间内）→ 候选 18:00 最早
  const now = Date.parse('2026-08-19T07:00:00.000Z'); // 15:00 +08
  const target = nextSmartTarget(now, TZ);
  assert.equal(new Date(target).toISOString(), '2026-08-19T10:00:00.000Z'); // 18:00 +08
});

test('nextSmartTarget 午休时段内 → now + 2 分钟', () => {
  const now = Date.parse('2026-08-19T05:00:00.000Z'); // 13:00 +08 午休
  const target = nextSmartTarget(now, TZ);
  assert.ok(target >= now + SMART_MIN_DELAY_MS - 1000 && target <= now + SMART_MIN_DELAY_MS + 1000);
});

test('nextSmartTarget 夜间静默 → 次日 09:00', () => {
  const now = Date.parse('2026-08-19T18:00:00.000Z'); // 次日02:00 +08（8/20）
  const target = nextSmartTarget(now, TZ);
  const f = localFieldsOf(target, TZ);
  assert.equal(f.hour, 9);
  assert.equal(f.minute, 0);
  assert.equal(f.day, 20);
});

test('nextSmartTarget 至少滞后 2 分钟', () => {
  const now = Date.now();
  const target = nextSmartTarget(now, TZ);
  assert.ok(target - now >= SMART_MIN_DELAY_MS - 1000);
});

test('nextSmartAt 返回可用的 at 对象', () => {
  const at = nextSmartAt(Date.parse('2026-08-19T07:00:00.000Z'), TZ);
  assert.ok(at !== null);
  assert.equal(at.time_zone, TZ);
  assert.match(at.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(at.time, /^\d{2}:\d{2}:\d{2}$/);
  // 回解析一致
  const back = epochFromLocal(at.date, at.time, TZ);
  assert.equal(back, at.epoch);
});

test('floorToMinute', () => {
  const now = Date.parse('2026-08-19T07:00:42.500Z');
  assert.equal(floorToMinute(now), Date.parse('2026-08-19T07:00:00.000Z'));
  assert.equal(floorToMinute(Math.floor(now / MINUTE_MS) * MINUTE_MS), Math.floor(now / MINUTE_MS) * MINUTE_MS);
});
