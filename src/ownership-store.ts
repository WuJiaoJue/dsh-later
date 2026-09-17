/**
 * 用户任务所有权的 sidecar 存储层。
 *
 * 为什么存在（2026-09 缺口事故的根治）：此前所有权经伴生会话事件
 * `session-scheduler/user-schedule` 写进会话日志——但该类型不在宿主事件
 * 词汇表内，持久化层在特定时序下会「seq 已消费但行未落盘」，在日志里留下
 * 永久 seq 缺口，任何读方（含格式迁移）都会拒读整份历史。根治 = 所有权
 * 完全移出会话日志，存到插件自己的 sidecar 文件：
 *
 *   <DSH_HOME>/plugin-state/later/<sessionId>.json
 *
 * 改名迁移：插件旧名 `session-scheduler` 的 sidecar 目录在首次启动时自动
 * 迁移（整个目录 rename；rename 失败则逐文件复制）。不写「一次性迁移
 * 标记」——重复执行天然幂等，且不引入新的丢失路径。
 *
 * - 原子写：临时文件 + rename；
 * - 容错读：JSON 损坏时把坏文件改名保留（.corrupt-<ts>），按空表继续；
 * - 进程内缓存：按 (mtimeMs, size) 校验，避免热路径反复读盘；
 * - 路径解析：`DSH_LATER_STATE_DIR`（测试/便携）> 旧名
 *   `DSH_LATER_STATE_DIR`（升级过渡）> `$DSH_HOME` > `~/.dsh`
 *   （与 dsh-home-paths 的默认解析一致）。
 *
 * 注意：本模块只被 host 端引用；client bundle 不得引入（依赖 node:fs）。
 * @module dsh-later/ownership-store
 */
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
  copyFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { UserScheduleDelivery } from './domain.js';

/** 单条所有权记录。 */
export interface OwnedEntry {
  /** 到点注入形态（/later 为 'user'，其余 'context'）。 */
  readonly delivery: UserScheduleDelivery;
  /** 创建时刻（epoch ms，诊断用）。 */
  readonly createdAt: number;
  /**
   * 稳定插件身份（跨 pause/resume/日志 id 变更）。创建时生成；
   * 旧条目可缺省（wire 回退用 scheduleId）。
   */
  readonly uid?: string;
  /**
   * 进度条总窗口（秒）。resume 后日志里的 `afterSeconds` 只是剩余时长，
   * 若直接当窗口会从 0 重跑；此处保留原 after 间隔供 wire/进度条使用。
   */
  readonly windowSeconds?: number;
}

/** 暂停留档（仅 kind==='after'；不进会话日志）。 */
export interface PausedEntry {
  /** 稳定身份；resume 后仍用此 uid。 */
  readonly uid: string;
  readonly prompt: string;
  readonly delivery: UserScheduleDelivery;
  readonly kind: 'after';
  /** 暂停瞬间的剩余秒数（resume 时 after_seconds）。 */
  readonly remainingSeconds: number;
  /** 原目标时刻（仅展示「原点 HH:MM」）。 */
  readonly originalScheduledAt: string;
  readonly originalAfterSeconds?: number;
  /** 暂停前的日志 schedule id（审计/关联）。 */
  readonly lastScheduleId: string;
  readonly pausedAt: number;
}

/** sidecar 文件形状（version 2；v1 读入时补空 paused）。 */
interface OwnershipFile {
  readonly version: 1 | 2;
  /** schedule id → 所有权记录。 */
  readonly entries: Record<string, OwnedEntry>;
  /** uid → 暂停留档（v1 无此字段）。 */
  readonly paused?: Record<string, PausedEntry>;
}

/** 解析状态目录（优先级见模块注释）。 */
function resolveStateDir(): string {
  const override = process.env['DSH_LATER_STATE_DIR'] ?? process.env['DSH_LATER_STATE_DIR'];
  if (override !== undefined && override.trim().length > 0) return override;
  const dshHomeEnv = process.env['DSH_HOME'];
  const home =
    dshHomeEnv !== undefined && dshHomeEnv.trim().length > 0 ? dshHomeEnv : join(homedir(), '.dsh');
  return join(home, 'plugin-state', 'later');
}

/**
 * 旧名 sidecar 目录（仅 `$DSH_HOME` 路径下存在；env 覆盖视为测试/便携场景，
 * 不做迁移以免污染调用方给定的目录语义）。
 */
function legacyStateDir(): string | undefined {
  const override = process.env['DSH_LATER_STATE_DIR'] ?? process.env['DSH_LATER_STATE_DIR'];
  if (override !== undefined && override.trim().length > 0) return undefined;
  const dshHomeEnv = process.env['DSH_HOME'];
  const home =
    dshHomeEnv !== undefined && dshHomeEnv.trim().length > 0 ? dshHomeEnv : join(homedir(), '.dsh');
  return join(home, 'plugin-state', 'session-scheduler');
}

/** 把旧名目录的 sidecar 文件搬到新目录（目录 rename 优先，失败逐文件复制；幂等）。 */
function migrateLegacyState(newDir: string): void {
  const oldDir = legacyStateDir();
  if (oldDir === undefined || !existsSync(oldDir)) return;
  try {
    renameSync(oldDir, newDir);
    return;
  } catch {
    /* 目标已存在等：退化为逐文件复制 */
  }
  try {
    for (const entry of readdirSync(oldDir)) {
      if (!entry.endsWith('.json')) continue;
      const target = join(newDir, entry);
      if (!existsSync(target)) copyFileSync(join(oldDir, entry), target);
    }
  } catch (error) {
    console.warn(
      `[dsh-later] 旧 sidecar 目录迁移失败（旧目录保留，可手动搬移）: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

let cachedDir: string | undefined;

/** 状态目录（懒创建；目录创建失败时返回原路径，由调用方容错）。 */
function stateDir(): string {
  if (cachedDir === undefined) {
    cachedDir = resolveStateDir();
    try {
      mkdirSync(cachedDir, { recursive: true });
      migrateLegacyState(cachedDir);
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
  return { version: 2, entries: {}, paused: {} };
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
      ((parsed as { version?: unknown }).version !== 1 &&
        (parsed as { version?: unknown }).version !== 2) ||
      typeof (parsed as { entries?: unknown }).entries !== 'object' ||
      (parsed as { entries?: unknown }).entries === null
    ) {
      throw new Error('unexpected shape');
    }
    // v1 → v2：补空 paused，写回时统一升到 2
    const file: OwnershipFile = {
      version: 2,
      entries: parsed.entries,
      paused: (parsed as { paused?: Record<string, PausedEntry> }).paused ?? {},
    };
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
        `[dsh-later] 所有权 sidecar 解析失败，已按空表继续: ${
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

/** 生成稳定插件 uid（pause/resume 跨日志 id 变更）。 */
export function newTaskUid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 记录（新增或覆盖）一条所有权；幂等。仅显式传入 `uid` 时写入稳定身份。 */
export function recordOwnership(
  sessionId: string,
  id: string,
  delivery: UserScheduleDelivery,
  uid?: string,
  windowSeconds?: number,
): OwnedEntry {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof id !== 'string' || id.length === 0) {
    const bare: OwnedEntry = {
      delivery,
      createdAt: Date.now(),
      ...(uid !== undefined ? { uid } : {}),
      ...(typeof windowSeconds === 'number' ? { windowSeconds } : {}),
    };
    return bare;
  }
  const file = readFresh(sessionId);
  const entries: Record<string, OwnedEntry> = { ...file.entries };
  const nextUid = uid ?? entries[id]?.uid;
  const nextWindow = windowSeconds ?? entries[id]?.windowSeconds;
  const entry: OwnedEntry = {
    delivery,
    createdAt: Date.now(),
    ...(nextUid !== undefined ? { uid: nextUid } : {}),
    ...(typeof nextWindow === 'number' ? { windowSeconds: nextWindow } : {}),
  };
  entries[id] = entry;
  writeThrough(sessionId, { version: 2, entries, paused: file.paused ?? {} });
  return entry;
}

/** 撤销一条所有权；幂等（不存在时无操作）。 */
export function removeOwnership(sessionId: string, id: string): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof id !== 'string' || id.length === 0) return;
  const file = readFresh(sessionId);
  if (!Object.prototype.hasOwnProperty.call(file.entries, id)) return;
  const entries: Record<string, OwnedEntry> = { ...file.entries };
  delete entries[id];
  writeThrough(sessionId, { version: 2, entries, paused: file.paused ?? {} });
}

/** 按 uid 找当前仍 active 的 schedule id（缺失 undefined）。 */
export function findScheduleIdByUid(sessionId: string, uid: string): string | undefined {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof uid !== 'string') return undefined;
  for (const [id, entry] of Object.entries(readFresh(sessionId).entries)) {
    if (entry.uid === uid) return id;
  }
  return undefined;
}

/** 全部暂停留档（uid → entry）。 */
export function allPaused(sessionId: string): Readonly<Record<string, PausedEntry>> {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return {};
  return readFresh(sessionId).paused ?? {};
}

/** 一条暂停留档。 */
export function getPaused(sessionId: string, uid: string): PausedEntry | undefined {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof uid !== 'string') return undefined;
  return (readFresh(sessionId).paused ?? {})[uid];
}

/** 按暂停前 schedule id 找留档（pause 刚写完、投影 fold 见 delete 时用）。 */
export function findPausedByScheduleId(sessionId: string, scheduleId: string): PausedEntry | undefined {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof scheduleId !== 'string') return undefined;
  for (const entry of Object.values(readFresh(sessionId).paused ?? {})) {
    if (entry.lastScheduleId === scheduleId) return entry;
  }
  return undefined;
}

/** 写入/覆盖一条暂停留档。 */
export function recordPaused(sessionId: string, entry: PausedEntry): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof entry.uid !== 'string') return;
  const file = readFresh(sessionId);
  writeThrough(sessionId, {
    version: 2,
    entries: file.entries,
    paused: { ...(file.paused ?? {}), [entry.uid]: entry },
  });
}

/** 移除一条暂停留档；幂等。 */
export function removePaused(sessionId: string, uid: string): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || typeof uid !== 'string') return;
  const file = readFresh(sessionId);
  const paused = { ...(file.paused ?? {}) };
  if (!Object.prototype.hasOwnProperty.call(paused, uid)) return;
  delete paused[uid];
  writeThrough(sessionId, { version: 2, entries: file.entries, paused });
}

/** 测试辅助：清空进程内缓存（不删文件）。 */
export function resetCacheForTests(): void {
  cache.clear();
  cachedDir = undefined;
}
