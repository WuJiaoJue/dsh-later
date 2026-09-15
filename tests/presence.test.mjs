/**
 * 侧栏「定时状态」badge 纯逻辑单测（src/presence.ts → lib/presence.js）。
 *
 * 覆盖：任务概要归纳（count/nextAt）、状态判定（scheduled/urgent/overdue）、
 * 相对时间标签分档（即将发送/分/小时/明天/日期/到期时钟面）。
 * @module tests/presence.test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeStateFor,
  hoverScheduleStatus,
  PRESENCE_URGENT_WINDOW_MS,
  relativeFireLabel,
  summarizeSchedules,
} from '../lib/presence.js';

const NOW = Date.parse('2026-09-05T12:00:00Z');
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

test('summarizeSchedules：取可解析数量与最早触发时刻', () => {
  const entry = summarizeSchedules([
    { scheduled_at: iso(10 * 60_000) },
    { scheduled_at: iso(2 * 60_000) },
    { scheduled_at: 'not-a-time' },
    {},
  ]);
  assert.equal(entry.count, 2);
  assert.equal(entry.nextAt, NOW + 2 * 60_000);

  assert.deepEqual(summarizeSchedules([]), { count: 0 });
  assert.deepEqual(summarizeSchedules(undefined), { count: 0 });
  assert.deepEqual(summarizeSchedules([{ scheduled_at: 'not-a-time' }]), { count: 0 });
});

test('summarizeSchedules：兼容 scheduledAt（runtime 记录形状）', () => {
  const entry = summarizeSchedules([{ scheduledAt: iso(5 * 60_000) }]);
  assert.equal(entry.count, 1);
  assert.equal(entry.nextAt, NOW + 5 * 60_000);
});

test('badgeStateFor：三态判定', () => {
  assert.equal(badgeStateFor(NOW + 2 * 60_000, NOW), 'urgent');
  assert.equal(badgeStateFor(NOW + PRESENCE_URGENT_WINDOW_MS, NOW), 'urgent');
  assert.equal(badgeStateFor(NOW + PRESENCE_URGENT_WINDOW_MS + 1, NOW), 'scheduled');
  assert.equal(badgeStateFor(NOW - 1, NOW), 'overdue');
  assert.equal(badgeStateFor(NOW, NOW), 'overdue');
  assert.equal(badgeStateFor(undefined, NOW), 'scheduled');
});

const zhLabels = {
  imminent: '即将发送',
  minutes: (m) => `${m} 分后`,
  hours: (h) => `${h} 小时后`,
  tomorrow: (time) => `明天 ${time}`,
  clock: (time) => time,
  date: (date, time) => `${date} ${time}`,
};

test('relativeFireLabel：到期/即将/分钟/小时/明天/日期 分档', () => {
  assert.equal(relativeFireLabel(NOW - 60_000, NOW, zhLabels, () => '14:00', () => '9月5日'), '14:00');
  assert.equal(relativeFireLabel(NOW + 30_000, NOW, zhLabels, () => '14:01', () => '9月5日'), '即将发送');
  assert.equal(relativeFireLabel(NOW + 5 * 60_000, NOW, zhLabels, () => '14:05', () => '9月5日'), '5 分后');
  assert.equal(relativeFireLabel(NOW + 2 * 3_600_000, NOW, zhLabels, () => '14:00', () => '9月5日'), '2 小时后');
  assert.equal(
    relativeFireLabel(NOW + 26 * 3_600_000, NOW, zhLabels, () => '14:00', () => '9月6日'),
    '明天 14:00',
  );
  assert.equal(
    relativeFireLabel(NOW + 50 * 3_600_000, NOW, zhLabels, () => '14:00', () => '9月7日'),
    '9月7日 14:00',
  );
});

const zhHover = {
  hoverScheduleStatus: '有 {n} 条定时提醒，下次 {time}',
  hoverScheduleOverdue: '有 {n} 条定时提醒已到期，等待发送',
};

test('hoverScheduleStatus：有任务时给出「条数 + 下次触发」文案', () => {
  // 30 分钟 > 5 分钟紧急窗口，故为 scheduled。
  const entry = summarizeSchedules([{ scheduled_at: iso(30 * 60_000) }]);
  const out = hoverScheduleStatus(entry, NOW, zhLabels, zhHover, () => '14:30', () => '9月5日');
  assert.equal(out.tone, 'scheduled');
  assert.equal(out.label, '有 1 条定时提醒，下次 30 分后');
});

test('hoverScheduleStatus：紧急窗口升级 tone、文案保留相对时间', () => {
  const entry = summarizeSchedules([{ scheduled_at: iso(2 * 60_000) }]);
  const out = hoverScheduleStatus(entry, NOW, zhLabels, zhHover, () => '14:02', () => '9月5日');
  assert.equal(out.tone, 'urgent');
  assert.equal(out.label, '有 1 条定时提醒，下次 2 分后');
});

test('hoverScheduleStatus：紧急窗口边界为闭区间（≤5min 为 urgent）', () => {
  const at = (ms) => hoverScheduleStatus(
    summarizeSchedules([{ scheduled_at: iso(ms) }]),
    NOW, zhLabels, zhHover, () => '14:00', () => '9月5日',
  ).tone;
  assert.equal(at(PRESENCE_URGENT_WINDOW_MS), 'urgent');
  assert.equal(at(PRESENCE_URGENT_WINDOW_MS + 1), 'scheduled');
});

test('hoverScheduleStatus：到期走 overdue 专用文案（不带时间槽）', () => {
  const entry = summarizeSchedules([{ scheduled_at: iso(-60_000) }]);
  const out = hoverScheduleStatus(entry, NOW, zhLabels, zhHover, () => '13:59', () => '9月5日');
  assert.equal(out.tone, 'overdue');
  assert.equal(out.label, '有 1 条定时提醒已到期，等待发送');
});

test('hoverScheduleStatus：多条任务汇总为总条数', () => {
  const entry = summarizeSchedules([
    { scheduled_at: iso(3 * 60_000) },
    { scheduled_at: iso(30 * 60_000) },
  ]);
  const out = hoverScheduleStatus(entry, NOW, zhLabels, zhHover, () => '14:03', () => '9月5日');
  assert.equal(out.label, '有 2 条定时提醒，下次 3 分后');
});

test('hoverScheduleStatus：nextAt 缺失时退化为 overdue 文案（不出现 {time} 残留）', () => {
  const out = hoverScheduleStatus({ count: 1 }, NOW, zhLabels, zhHover, () => '14:00', () => '9月5日');
  assert.equal(out.label.includes('{time}'), false);
  assert.equal(out.label, '有 1 条定时提醒已到期，等待发送');
});
