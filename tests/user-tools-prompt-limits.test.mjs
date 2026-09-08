/**
 * 提示字符上限（allowLongPrompts / maxPromptChars）的单元 + 集成测试。
 *
 * 覆盖：
 *  - 默认（allowLong=false）保持 1000 字符硬上限：>1000 报错，错误消息含「1000」。
 *  - 开启 allowLong=true + maxChars=4000：4000 通过、4001 报错、消息含「4000」。
 *  - maxChars 非法值（NaN、负数、小数）回落到 1000。
 *  - 关闭时即使 maxChars 配置了 5000 也仍按 1000 校验。
 *  - validatePrompt 单元：trim、空、非字符串、长度边界。
 *  - resolvePromptLimits 单元：allowLong=false 屏蔽 maxChars；非法值回落。
 *  - userScheduleEditPrompt 接受 limits：默认上限同样生效。
 *
 * 这些都是纯函数行为，不依赖 cordis / agent 生命周期，因此不开 agent 集成也能覆盖
 * 大部分；create/edit 的端到端路径用 fakeAgent/fakeCtx 走真实持久化（与
 * user-tools.test.mjs 风格一致）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_PROMPT_CHARS,
  resolvePromptLimits,
  validatePrompt,
  userScheduleCreate,
  userScheduleEditPrompt,
} from '../lib/user-tools.js';

const LONG_OK_INPUT = {
  prompt: 'x',
  after_seconds: 3600,
  time_zone: 'Asia/Shanghai',
};

const fakeCtx = { sessions: { flush: async () => true } };

function fakeAgent(events = []) {
  return {
    id: 'agent-limits',
    session: {
      header: { seedLength: 0 },
      events: events.map((event, index) => ({ seq: index, time: 0, ...event })),
      appended: [],
      append(type, data) {
        const seq = this.events.length;
        const event = { type, seq, time: Date.now(), data };
        this.events.push(event);
        this.appended.push(event);
        return event;
      },
    },
    ctx: {},
  };
}

const longText = (n) => 'a'.repeat(n);

test('resolvePromptLimits：默认 allowLong=false 时 maxChars 恒等于 1000', () => {
  const a = resolvePromptLimits(undefined);
  assert.equal(a.allowLong, false);
  assert.equal(a.maxChars, 1000);

  const b = resolvePromptLimits({ allowLongPrompts: false, maxPromptChars: 5000 });
  assert.equal(b.allowLong, false);
  assert.equal(b.maxChars, 1000);
});

test('resolvePromptLimits：allowLong=true + 合法 maxChars 时取用户配置', () => {
  const r = resolvePromptLimits({ allowLongPrompts: true, maxPromptChars: 4000 });
  assert.equal(r.allowLong, true);
  assert.equal(r.maxChars, 4000);
});

test('resolvePromptLimits：allowLong=true + 非法 maxChars 回落到 1000', () => {
  for (const bad of [NaN, -1, 0, 1.5, 'big', null, undefined]) {
    const r = resolvePromptLimits({ allowLongPrompts: true, maxPromptChars: bad });
    assert.equal(r.allowLong, false, `bad=${String(bad)} 应回落为 allowLong=false`);
    assert.equal(r.maxChars, 1000, `bad=${String(bad)} 应回落 maxChars=1000`);
  }
});

test('validatePrompt：空 / 非字符串 → invalid_prompt', () => {
  for (const bad of ['', '   ', null, undefined, 42, {}, []]) {
    const r = validatePrompt(bad, { allowLong: true, maxChars: 5000 });
    assert.equal(r.ok, false, `bad=${JSON.stringify(bad)}`);
    if (!r.ok) {
      assert.equal(r.code, 'invalid_prompt');
      assert.match(r.message, /不能为空/);
    }
  }
});

test('validatePrompt：trim 后长度 > maxChars → invalid_prompt，消息含 maxChars', () => {
  const r = validatePrompt(longText(1001), { allowLong: false, maxChars: 1000 });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'invalid_prompt');
    assert.match(r.message, /1000/);
  }
});

test('validatePrompt：边界长度等于 maxChars 仍通过', () => {
  const r = validatePrompt(longText(1000), { allowLong: false, maxChars: 1000 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.length, 1000);
});

test('userScheduleCreate：默认（无 limits 入参）1000 字符上限生效', async () => {
  const agent = fakeAgent();
  const result = await userScheduleCreate(
    { ...LONG_OK_INPUT, prompt: longText(1001) },
    agent,
    fakeCtx,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'invalid_prompt');
    assert.match(result.message, /1000/);
  }
});

test('userScheduleCreate：allowLong=false 即便 settings.maxChars=5000 仍按 1000 校验', async () => {
  const agent = fakeAgent();
  const limits = resolvePromptLimits({ allowLongPrompts: false, maxPromptChars: 5000 });
  const result = await userScheduleCreate(
    { ...LONG_OK_INPUT, prompt: longText(4000) },
    agent,
    fakeCtx,
    100,
    undefined,
    limits,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /1000/);
});

test('userScheduleCreate：allowLong=true + maxChars=4000 时 4000 字符通过', async () => {
  const agent = fakeAgent();
  const limits = resolvePromptLimits({ allowLongPrompts: true, maxPromptChars: 4000 });
  const result = await userScheduleCreate(
    { ...LONG_OK_INPUT, prompt: longText(4000) },
    agent,
    fakeCtx,
    100,
    undefined,
    limits,
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.equal(result.prompt.length, 4000);
});

test('userScheduleCreate：allowLong=true + maxChars=4000 时 4001 字符被拒，消息含 4000', async () => {
  const agent = fakeAgent();
  const limits = resolvePromptLimits({ allowLongPrompts: true, maxPromptChars: 4000 });
  const result = await userScheduleCreate(
    { ...LONG_OK_INPUT, prompt: longText(4001) },
    agent,
    fakeCtx,
    100,
    undefined,
    limits,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'invalid_prompt');
    assert.match(result.message, /4000/);
  }
});

test('userScheduleEditPrompt：默认上限同样生效', async () => {
  const agent = fakeAgent();
  const created = await userScheduleCreate(LONG_OK_INPUT, agent, fakeCtx);
  assert.ok(created.ok);
  if (!created.ok) return;
  const edit = await userScheduleEditPrompt(created.id, longText(1001), agent, fakeCtx);
  assert.equal(edit.ok, false);
  if (!edit.ok) {
    assert.equal(edit.code, 'invalid_prompt');
    assert.match(edit.message, /1000/);
  }
});

test('userScheduleEditPrompt：allowLong=true 时超长 prompt 接受', async () => {
  const agent = fakeAgent();
  const created = await userScheduleCreate(LONG_OK_INPUT, agent, fakeCtx);
  assert.ok(created.ok);
  if (!created.ok) return;
  const limits = resolvePromptLimits({ allowLongPrompts: true, maxPromptChars: 4000 });
  const edit = await userScheduleEditPrompt(created.id, longText(3000), agent, fakeCtx, limits);
  assert.equal(edit.ok, true, JSON.stringify(edit));
  if (edit.ok) assert.equal(edit.prompt.length, 3000);
});

test('常量 DEFAULT_MAX_PROMPT_CHARS 必须为 1000（默认安全的下限）', () => {
  assert.equal(DEFAULT_MAX_PROMPT_CHARS, 1000);
});