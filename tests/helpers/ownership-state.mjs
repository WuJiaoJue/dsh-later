/**
 * 测试辅助：把所有权 sidecar 指到一次性临时目录，并提供标记/清空工具。
 *
 * 必须在导入 lib 模块**之前**调用 `freshOwnershipDir()`（目录在首次使用时
 * 解析并缓存）。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordOwnership, resetCacheForTests } from '../../lib/ownership-store.js';

/** 新建一次性状态目录并让插件指向它；返回目录路径。 */
export function freshOwnershipDir() {
  const dir = mkdtempSync(join(tmpdir(), 'sched-ownership-'));
  process.env.DSH_LATER_STATE_DIR = dir;
  resetCacheForTests();
  return dir;
}

/** 在当前状态目录里标记一条用户所有权（等价于旧版写入伴生事件）。 */
export function markOwnership(sessionId, id, delivery = 'context') {
  recordOwnership(sessionId, id, delivery);
}
