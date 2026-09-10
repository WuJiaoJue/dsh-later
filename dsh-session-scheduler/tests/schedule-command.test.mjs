/**
 * `/schedule` 快捷命令的时间解析测试（parseScheduleSpec / parseScheduleInput 纯函数）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScheduleSpec, parseScheduleInput } from '../lib/commands.js';
import { epochFromLocal, localFieldsOf } from '../lib/smart-window.js';

const TZ = 'Asia/Shanghai';
/** 固定「现在」：2026-08-20 12:00:00 Asia/Shanghai。 */
const NOW = epochFromLocal('2026-08-20', '12:00:00', TZ);
if (NOW === undefined) throw new Error('bad fixture');

test('相对时长：+30m / +2h / +1d', () => {
  const m = parseScheduleSpec('+30m', NOW, TZ);
  assert.ok(m.ok && m.kind === 'after' && m.afterSeconds === 1800);
  const h = parseScheduleSpec('+2h', NOW, TZ);
  assert.ok(h.ok && h.kind === 'after' && h.afterSeconds === 7200);
  const d = parseScheduleSpec('+1d', NOW, TZ);
  assert.ok(d.ok && d.kind === 'after' && d.afterSeconds === 86400);
});

test('相对时长：非法值拒绝', () => {
  assert.ok(!parseScheduleSpec('+0m', NOW, TZ).ok);
  assert.ok(!parseScheduleSpec('+xm', NOW, TZ).ok);
});

test('HHMM：今天未过 → 今天该时刻', () => {
  const r = parseScheduleSpec('1532', NOW, TZ);
  assert.ok(r.ok && r.kind === 'at');
  if (r.ok && r.kind === 'at') {
    const f = localFieldsOf(r.epoch, TZ);
    assert.equal(f.month, 8);
    assert.equal(f.day, 20);
    assert.equal(f.hour, 15);
    assert.equal(f.minute, 32);
    assert.equal(r.at.time_zone, TZ);
  }
});

test('HHMM：今天已过 → 明天同一时刻', () => {
  const r = parseScheduleSpec('0900', NOW, TZ);
  assert.ok(r.ok && r.kind === 'at');
  if (r.ok && r.kind === 'at') {
    const f = localFieldsOf(r.epoch, TZ);
    assert.equal(f.day, 21); // 明天
    assert.equal(f.hour, 9);
  }
});

test('HHMM：非法小时拒绝', () => {
  assert.ok(!parseScheduleSpec('9932', NOW, TZ).ok);
});

test('MMDD-HHMM：今年 08-21 15:32', () => {
  const r = parseScheduleSpec('0821-1532', NOW, TZ);
  assert.ok(r.ok && r.kind === 'at');
  if (r.ok && r.kind === 'at') {
    const f = localFieldsOf(r.epoch, TZ);
    assert.equal(f.year, 2026);
    assert.equal(f.month, 8);
    assert.equal(f.day, 21);
    assert.equal(f.hour, 15);
    assert.equal(f.minute, 32);
  }
});

test('MMDD-HHMM：今年已过 → 明年', () => {
  const r = parseScheduleSpec('0819-1532', NOW, TZ); // 8月19 已过
  assert.ok(r.ok && r.kind === 'at');
  if (r.ok && r.kind === 'at') {
    const f = localFieldsOf(r.epoch, TZ);
    assert.equal(f.year, 2027);
    assert.equal(f.month, 8);
    assert.equal(f.day, 19);
  }
});

test('YYYYMMDD-HHMM：显式日期', () => {
  const r = parseScheduleSpec('20260821-1532', NOW, TZ);
  assert.ok(r.ok && r.kind === 'at');
  if (r.ok && r.kind === 'at') {
    assert.equal(r.at.date, '2026-08-21');
    assert.equal(r.at.time, '15:32:00');
  }
});

test('YYYYMMDD-HHMM：过去日期拒绝', () => {
  const r = parseScheduleSpec('20200101-0000', NOW, TZ);
  assert.ok(!r.ok);
});

test('未知格式拒绝', () => {
  assert.ok(!parseScheduleSpec('abc', NOW, TZ).ok);
  assert.ok(!parseScheduleSpec('', NOW, TZ).ok);
});

/* ==================== 宽容格式（parseScheduleInput） ==================== */

test('宽容：15:32 冒号格式', () => {
  const r = parseScheduleInput('15:32 开会', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.hour, 15);
    assert.equal(f.minute, 32);
    assert.equal(r.content, '开会');
  }
});

test('宽容：全角冒号 15：32', () => {
  const r = parseScheduleInput('15：32 提醒', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.hour, 15);
    assert.equal(f.minute, 32);
  }
});

test('宽容：15时32分', () => {
  const r = parseScheduleInput('15时32分 测试', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.hour, 15);
    assert.equal(f.minute, 32);
  }
});

test('宽容：+1h30m 组合相对', () => {
  const r = parseScheduleInput('+1h30m 内容', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'after' && r.target.afterSeconds === 5400);
});

test('宽容：+90s 秒 / +1w 周', () => {
  const s = parseScheduleInput('+90s x', NOW, TZ);
  assert.ok(s.ok && s.target.kind === 'after' && s.target.afterSeconds === 90);
  const w = parseScheduleInput('+1w x', NOW, TZ);
  assert.ok(w.ok && w.target.kind === 'after' && w.target.afterSeconds === 604800);
});

test('宽容：30分钟后 / 半小时后 / 两小时后', () => {
  const a = parseScheduleInput('30分钟后 x', NOW, TZ);
  assert.ok(a.ok && a.target.kind === 'after' && a.target.afterSeconds === 1800);
  const b = parseScheduleInput('半小时后 x', NOW, TZ);
  assert.ok(b.ok && b.target.kind === 'after' && b.target.afterSeconds === 1800);
  const c = parseScheduleInput('两小时后 x', NOW, TZ);
  assert.ok(c.ok && c.target.kind === 'after' && c.target.afterSeconds === 7200);
});

test('宽容：明天 15:32（带空格 + 内容切分）', () => {
  const r = parseScheduleInput('明天 15:32 参加评审', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.day, 21); // 明天
    assert.equal(f.hour, 15);
    assert.equal(r.content, '参加评审');
  }
});

test('宽容：后天9点（无空格）', () => {
  const r = parseScheduleInput('后天9点 站会', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.day, 22); // 后天
    assert.equal(f.hour, 9);
    assert.equal(f.minute, 0);
    assert.equal(r.content, '站会');
  }
});

test('宽容：9点半 → 09:30', () => {
  const r = parseScheduleInput('9点半 喝水', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.hour, 9);
    assert.equal(f.minute, 30);
  }
});

test('宽容：今天已过时刻明确报错（不静默顺延）', () => {
  const r = parseScheduleInput('今天 9点 已过期场景', NOW, TZ); // NOW=12:00
  assert.ok(!r.ok);
  assert.match(r.error, /已过去/);
});

test('宽容：8月21日 15:32', () => {
  const r = parseScheduleInput('8月21日 15:32 交报告', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    const f = localFieldsOf(r.target.epoch, TZ);
    assert.equal(f.month, 8);
    assert.equal(f.day, 21);
    assert.equal(r.content, '交报告');
  }
});

test('宽容：2026-08-21 15:32 ISO 风格', () => {
  const r = parseScheduleInput('2026-08-21 15:32 x', NOW, TZ);
  assert.ok(r.ok && r.target.kind === 'at');
  if (r.ok && r.target.kind === 'at') {
    assert.equal(r.target.at.date, '2026-08-21');
  }
});

test('宽容：缺少内容报错', () => {
  const r = parseScheduleInput('1532', NOW, TZ);
  assert.ok(!r.ok);
  assert.match(r.error, /内容不能为空/);
});

/**
 * /later 与 /schedule 的 delivery 分流：
 * 命令工厂应产出 `context`(/schedule) 与 `user`(/later) 两种 handler，
 * 并把 delivery 正确写入创建输入（user 路径）——交付形态由 runtime 的分流
 * （foldOwnedDelivery → buildMessage）负责，见 projection-unit 与 runtime 测试。
 */
test('/later 与 /schedule 都在命令表里，delivery 分流正确', async () => {
  const { userScheduleCommands } = await import('../lib/commands.js');
  const { foldOwnedDelivery } = await import('../lib/user-tools.js');
  const defs = userScheduleCommands({}, 100, () => {});
  const names = defs.map((d) => d.name);
  assert.ok(names.includes('schedule'));
  assert.ok(names.includes('later'));

  // 纯 fold 分流验证：user 路径读出 'user'，缺省读出 'context'
  const mkOwned = (delivery, id = 's1') => ({
    type: 'session-scheduler/user-schedule',
    seq: 0,
    time: 0,
    data: { version: 1, operation: 'add', id, ...(delivery ? { delivery } : {}) },
  });
  assert.equal(foldOwnedDelivery([mkOwned('user')]).get('s1'), 'user');
  assert.equal(foldOwnedDelivery([mkOwned(undefined)]).get('s1'), 'context');
});
