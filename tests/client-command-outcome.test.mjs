/**
 * commands 通道的 admission 契约：只回 `{matched}`。
 *
 * 客户端曾试图从返回值里读 handler 的业务结果（如 delete 的 `deleted`）来做
 * 乐观 UI 回滚——但框架根本不回那个字段，导致「删除暂停项成功」被误判为
 * 未删除、行被重新显示。这里锁住契约，防止再有人依赖不存在的返回值。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('commands 结果类型只有 matched（业务结果不经返回值）', () => {
  const src = readFileSync(new URL('../src/command-outcome.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export interface CommandOutcome'));
  // 接口体内不得再出现 text / deleted 之类业务字段
  const iface = body.slice(0, body.indexOf('}'));
  assert.match(iface, /matched/);
  assert.doesNotMatch(iface, /text\??:/, 'CommandOutcome 不应带业务载荷字段');
  assert.doesNotMatch(iface, /deleted\??:/, 'CommandOutcome 不应带业务载荷字段');
});

test('host 的 delete 仍遵守幂等语义（供观察窗对账逻辑成立）', () => {
  const src = readFileSync(new URL('../src/user-tools.ts', import.meta.url), 'utf8');
  // 找不到目标时必须返回 deleted:false + schedule_not_found，而不是静默成功
  assert.match(src, /deleted: false, code: 'schedule_not_found'/);
});
