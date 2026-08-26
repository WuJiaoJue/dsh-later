/**
 * domain 回归测试：自有事件类型必须能注册进宿主已知集合。
 *
 * 背景：dsh-session 持久化读路径对「白名单外且未标 ignorable」的事件整份拒读
 * （SessionFormatUnsupportedError）。当前构建的 Session.append 无法写入
 * ignorable 标记，因此插件激活时调用 registerOwnedSessionEventType() 把
 * OWNED_EVENT 登记进 KNOWN_SESSION_EVENT_TYPES（进程级、幂等）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_SESSION_EVENT_TYPES } from '@deepseek-ai/dsh-session';
import { OWNED_EVENT } from '../lib/domain.js';
import { registerOwnedSessionEventType } from '../lib/owned-event-registration.js';

test('OWNED_EVENT 注册进宿主已知事件类型集合', () => {
  registerOwnedSessionEventType();
  assert.ok(
    KNOWN_SESSION_EVENT_TYPES.has(OWNED_EVENT),
    '注册后宿主读者应接受 session-scheduler/user-schedule 事件',
  );
});

test('重复注册幂等（不抛错、仍生效）', () => {
  registerOwnedSessionEventType();
  registerOwnedSessionEventType();
  assert.ok(KNOWN_SESSION_EVENT_TYPES.has(OWNED_EVENT));
});
