/**
 * 用户任务所有权的 sidecar 存储层。
 *
 * 为什么存在（2026-09 缺口事故的根治）：此前所有权经伴生会话事件
 * `session-scheduler/user-schedule` 写进会话日志——但该类型不在宿主事件
 * 词汇表内，持久化层在特定时序下会「seq 已消费但行未落盘」，在日志里留下
 * 永久 seq 缺口，任何读方（含格式迁移）都会拒读整份历史。根治 = 所有权
 * 完全移出会话日志，存到插件自己的 sidecar 文件：
 *
 *   <DSH_HOME>/plugin-state/session-scheduler/<sessionId>.json
 *
 * - 原子写：临时文件 + rename；
 * - 容错读：JSON 损坏时把坏文件改名保留（.corrupt-<ts>），按空表继续；
 * - 进程内缓存：按 (mtimeMs, size) 校验，避免热路径反复读盘；
 * - 路径解析：`DSH_SESSION_SCHEDULER_STATE_DIR`（测试/便携）>
 *   `$DSH_HOME` > `~/.dsh`（与 dsh-home-paths 的默认解析一致）。
 *
 * 注意：本模块只被 host 端引用；client bundle 不得引入（依赖 node:fs）。
 * @module dsh-session-scheduler/ownership-store
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { UserScheduleDelivery } from './domain.js';

/** 单条所有权记录。 */
export interface OwnedEntry {
  /** 到点注入形态（/later 为 'user'，其余 'context'）。 */
  readonly delivery: UserScheduleDelivery;
  /** 创建时刻（epoch ms，诊断用）。 */
  readonly createdAt: number;
}

/** sidecar 文件形状（version 1）。 */
interface OwnershipFile {
  readonly version: 1;
  /** schedule id → 所有权记录。 */
  readonly entries: Record<string, OwnedEntry>;
}

/** 解析状态目录（优先级见模块注释）。 */
function resolveStateDir(): string {
  const override = process.env['DSH_SESSION_SCHEDULER_STATE_DIR'];
  if (override !== undefined && override.trim().length > 0) return override;
  const dshHomeEnv = process.env['DSH_HOME'];
  const home =
    dshHomeEnv !== undefined && dshHomeEnv.trim().length > 0 ? dshHomeEnv : join(homedir(), '.dsh');
  return join(home, 'plugin-state', 'session-scheduler');
}

let cachedDir: string | undefined;

/** 状态目录（懒创建；目录创建失败时返回原路径，由调用方容错）。 */
function stateDir(): string {
  if (cachedDir === undefined) {
    cachedDir = resolveStateDir();
    try {
      mkdirSync(cachedDir, { recursive: true });
    } catch {
      /* 读写时再报错 */
    }
  }
  return cachedDir;
}

function fileOf(sessionId: string): string {
  // sessionId 形如 session-<uuid>，字符安全；仍做一次兜底清洗。
  const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, '_');
  return join(stateDir(), `${safe}.json`);
}

function emptyFile(): OwnershipFile {
  return { version: 1, entries: {} };
}

interface CacheRow {
  readonly mtimeMs: number;
  readonly size: number;
  readonly file: OwnershipFile;
}

/** 进程内缓存：sessionId → (mtime, size, file)。写路径同步更新缓存。 */
const cache = new Map<string, CacheRow>();

function readFresh(sessionId: string): OwnershipFile {
  const path = fileOf(sessionId);
  let stat;
  try {
    stat = statSync(path);
  } catch {
    cache.delete(sessionId);
    return emptyFile();
  }
  const cached = cache.get(sessionId);
  if (cached !== undefined && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.file;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as OwnershipFile;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { version?: unknown }).version !== 1 ||
      typeof (parsed as { entries?: unknown }).entries !== 'object' ||
      (parsed as { entries?: unknown }).entries === null
    ) {
      throw new Error('unexpected shape');
    }
    const file = parsed;
    cache.set(sessionId, { mtimeMs: stat.mtimeMs, size: stat.size, file });
    return file;
  } catch (error) {
    // 损坏文件：改名保留现场，按空表继续（不静默删除，方便离线排查）。
    try {
      renameSync(path, `${path}.corrupt-${Date.now()}`);
    } catch {
      /* 改名失败也按空表继续 */
    }
    cache.delete(sessionId);
    try {
      // eslint 由库外保证；这里用 console 而非宿主 logger（本层无 ctx 依赖）。
      console.warn(
        `[dsh-session-scheduler] 所有权 sidecar 解析失败，已按空表继续: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } catch {
      /* 通知失败不影响语义 */
    }
    return emptyFile();
  }
}

/** 读取某会话的全部所有权记录（缓存优先；返回副本语义，调用方不得变更）。 */
export function allOwnership(sessionId: string): Readonly<Record<string, OwnedEntry>> {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return {};
  return readFresh(sessionId).entries;
}

/** 某 schedule id 是否由用户工具创建。 */
export function hasOwnership(sessionId: string, id: string): boolean {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof id !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(readFresh(sessionId).entries, id);
}

/** 某条所有权记录（缺失返回 undefined）。 */
export function getOwnership(sessionId: string, id: string): OwnedEntry | undefined {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof id !== 'string') return undefined;
  return readFresh(sessionId).entries[id];
}

function writeThrough(sessionId: string, file: OwnershipFile): void {
  const path = fileOf(sessionId);
  const dir = stateDir();
  const tmp = join(dir, `.${safeName(sessionId)}.${process.pid}.${Date.now()}.tmp`);
  const payload = `${JSON.stringify(file, null, 2)}\n`;
  writeFileSync(tmp, payload, 'utf8');
  try {
    renameSync(tmp, path);
  } catch {
    // 极端场景（跨设备等）：退化为直接写目标文件。
    writeFileSync(path, payload, 'utf8');
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* 清理失败不影响语义 */
    }
  }
  const stat = statSync(path);
  cache.set(sessionId, { mtimeMs: stat.mtimeMs, size: stat.size, file });
}

function safeName(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9._-]/g, '_');
}

/** 记录（新增或覆盖）一条所有权；幂等。 */
export function recordOwnership(sessionId: string, id: string, delivery: UserScheduleDelivery): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof id !== 'string' || id.length === 0) return;
  const file = readFresh(sessionId);
  const entries: Record<string, OwnedEntry> = { ...file.entries };
  entries[id] = { delivery, createdAt: Date.now() };
  writeThrough(sessionId, { version: 1, entries });
}

/** 撤销一条所有权；幂等（不存在时无操作）。 */
export function removeOwnership(sessionId: string, id: string): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof id !== 'string' || id.length === 0) return;
  const file = readFresh(sessionId);
  if (!Object.prototype.hasOwnProperty.call(file.entries, id)) return;
  const entries: Record<string, OwnedEntry> = { ...file.entries };
  delete entries[id];
  writeThrough(sessionId, { version: 1, entries });
}

/** 测试辅助：清空进程内缓存（不删文件）。 */
export function resetCacheForTests(): void {
  cache.clear();
  cachedDir = undefined;
}
