/**
 * 待发送提醒 dock（呈现对齐 DSH QueueDock）。
 *
 * 位置：输入框上方 dock 区（conversation.input.dock，与排队消息同区）。
 * 行为：
 *  - 空列表不渲染
 *  - 单条：直接显示 内容 + 时间 + 单独取消/修改
 *  - 多条：折叠为「数量 header + 下一条预览」，点击展开列表（max-height 180px）
 *  - 每条可单独取消；可点击编辑图标进入行内修改内容（保留原时刻）
 * @module dsh-later/client/components/ScheduleDock
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { detectTimeZone, formatHhmm } from '../../time-utils.js';
import { format, type SchedStrings } from '../strings.js';
import { useNow } from '../useCountdown.js';
import { useSchedT, type LocaleFaceLike } from '../useSchedT.js';
import type { ClientSchedule } from '../types.js';

/** 精确剩余时长：超过 1 小时 `H:MM:SS`，否则 `MM:SS`（负值截为 00:00）。 */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 每根进度条代表的时长（1 小时 = 一根满管）。 */
const BAR_UNIT_MS = 3_600_000;

/**
 * 推导进度条起点与总窗口（暂停/活动期共用同一套时间基准）。
 * - `after`：`window_seconds`（resume 后保留的原间隔）→ `after_seconds` → `created_at` → 首见时刻
 * - `every`：`every_seconds` 反推
 * - 其余：`created_at` → 首见时刻
 */
function barWindow(
  item: ClientSchedule,
  end: number,
  now: number,
  firstSeen: ReadonlyMap<string, number>,
): { readonly start: number; readonly totalMs: number } {
  let start: number;
  if (item.kind === 'after') {
    // resume 后 after_seconds=剩余；window_seconds=原间隔 → 进度从冻结处继续
    const windowSec = item.window_seconds ?? item.after_seconds;
    if (windowSec !== undefined) {
      start = end - windowSec * 1000;
    } else if (item.created_at !== undefined) {
      const parsed = Date.parse(item.created_at);
      start = Number.isNaN(parsed) ? (firstSeen.get(item.id) ?? now) : parsed;
    } else {
      start = firstSeen.get(item.id) ?? now;
    }
  } else if (item.kind === 'every' && item.every_seconds !== undefined) {
    start = end - item.every_seconds * 1000;
  } else if (item.created_at !== undefined) {
    const parsed = Date.parse(item.created_at);
    start = Number.isNaN(parsed) ? (firstSeen.get(item.id) ?? now) : parsed;
  } else {
    start = firstSeen.get(item.id) ?? now;
  }
  return { start, totalMs: Math.max(1000, end - start) };
}

/**
 * 活动期进度比：elapsed / total（elapsed 钳在 [0, total]）。
 * 与 {@link frozenBarSegments} 共用 {@link barWindow}，保证暂停前后只有 `now` 不同。
 */
function barSegments(
  item: ClientSchedule,
  now: number,
  firstSeen: ReadonlyMap<string, number>,
): { readonly totalRatio: number; readonly count: number } {
  const end = Date.parse(item.scheduled_at);
  const { start, totalMs } = barWindow(item, end, now, firstSeen);
  const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
  const totalRatio = elapsedMs / totalMs;
  const count = Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS));
  return { totalRatio, count };
}

/**
 * 暂停冻结进度比：把 `now` 换成暂停时刻，其余基准与活动期完全一致。
 * - 优先用 `paused_at`（精确 ms），与暂停前最后一帧渲染的 elapsed 同源，
 *   消除 `remaining_seconds` 整数秒取整造成的长度跳变
 * - 回退 `remaining_seconds`（旧 sidecar / 旧 host 缺 `paused_at` 时，
 *   向下取整使冻结比不超过暂停前真实进度）
 * - 不做额外的最小可见比抬升：极早期进度由 CSS `min-width` 统一兜底，
 *   active 与 paused 同一规则，避免暂停前后保底阈值不一致
 */
function frozenBarSegments(
  item: ClientSchedule,
  frozenLeftMs: number,
  firstSeen: ReadonlyMap<string, number>,
): { readonly totalRatio: number; readonly count: number } {
  const end = Date.parse(item.scheduled_at);
  const now = Date.parse(item.paused_at ?? '');
  const frozenNow = Number.isNaN(now)
    ? end - Math.floor(frozenLeftMs / 1000) * 1000
    : now;
  const { start, totalMs } = barWindow(item, end, frozenNow, firstSeen);
  const elapsedMs = Math.min(Math.max(frozenNow - start, 0), totalMs);
  const totalRatio = elapsedMs / totalMs;
  const count = Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS));
  return { totalRatio, count };
}

/** 应用层注入的调用能力。 */
export interface ScheduleDockInjected {
  /** 向宿主执行一条 slash 命令；返回是否受理。 */
  callCommand: (sessionId: string, line: string) => Promise<boolean>;
  /** 宿主 locale 服务（跟随 DSH 界面语言；缺失回退中文）。 */
  locale?: LocaleFaceLike;
}

/** 会话作用域插槽条目收到的标准 props + 注入。 */
export interface ScheduleDockProps extends Omit<ScheduleDockInjected, 'locale'> {
  /** 向宿主执行一条 slash 命令；返回是否受理。 */
  callCommand: (sessionId: string, line: string) => Promise<boolean>;
  /** 宿主 locale 服务（跟随 DSH 界面语言；缺失回退中文）。 */
  locale?: LocaleFaceLike;
  /** 会话作用域标准 hook：读取投影。 */
  useProjection?: (key: string) => { schedules?: readonly ClientSchedule[] } | undefined;
  /** 会话 id。 */
  sessionId?: string;
}

const deleteLine = (id: string): string => `/user-schedule-delete ${JSON.stringify({ id })}`;
const editLine = (id: string, prompt: string): string =>
  `/user-schedule-edit ${JSON.stringify({ id, prompt })}`;
const steerLine = (id: string): string => `/user-schedule-steer-now ${JSON.stringify({ id })}`;
const pauseLine = (id: string): string => `/user-schedule-pause ${JSON.stringify({ id })}`;
const resumeLine = (uid: string): string => `/user-schedule-resume ${JSON.stringify({ uid })}`;

/** 仅 after 且未到点可暂停（与 host 校验一致）。 */
function canPause(item: ClientSchedule, now: number): boolean {
  if (item.status === 'paused') return false;
  if (item.kind !== 'after') return false;
  const epoch = Date.parse(item.scheduled_at);
  return Number.isFinite(epoch) && epoch > now;
}

export function ScheduleDock({ callCommand, sessionId, useProjection, locale }: ScheduleDockProps): JSX.Element | null {
  const now = useNow(1000);
  const { t } = useSchedT(locale);
  const projection = typeof useProjection === 'function' ? useProjection('userSchedules') : undefined;
  // 删除暂停项只改 sidecar、不写会话事件 → 投影不会立刻更新；成功后本地先摘掉
  const [dismissedPaused, setDismissedPaused] = useState<ReadonlySet<string>>(new Set());
  const schedules = useMemo(
    () =>
      (projection?.schedules ?? [])
        .filter((item) => !(item.status === 'paused' && dismissedPaused.has(item.id)))
        .sort(
          (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
        ) as ClientSchedule[],
    [projection, dismissedPaused],
  );

  const [collapsed, setCollapsed] = useState(true);
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set());
  // 行内编辑状态：正在编辑的 schedule id → 当前输入
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 插话发送：tracking 每个 id 的状态（idle / pending / done / failed-with-code）。
  const [steering, setSteering] = useState<ReadonlySet<string>>(new Set());
  const [steerDone, setSteerDone] = useState<ReadonlySet<string>>(new Set());
  const [steerErr, setSteerErr] = useState<ReadonlyMap<string, string>>(new Map());
  // 暂停 / 恢复
  const [pausing, setPausing] = useState<ReadonlySet<string>>(new Set());
  const [resuming, setResuming] = useState<ReadonlySet<string>>(new Set());
  const [pauseErr, setPauseErr] = useState<ReadonlyMap<string, string>>(new Map());

  // 进度条起点：首次见到任务 id 的本地时刻（仅 at 类任务需要）。
  const firstSeenRef = useRef<ReadonlyMap<string, number>>(new Map());

  const byId = useMemo(() => new Map(schedules.map((item) => [item.id, item] as const)), [schedules]);
  useEffect(() => {
    // 记录新任务的首次可见时刻（进度条近似起点）
    let changed = false;
    const next = new Map(firstSeenRef.current);
    for (const [id] of byId) {
      if (!next.has(id)) {
        next.set(id, Date.now());
        changed = true;
      }
    }
    for (const id of [...next.keys()]) {
      if (!byId.has(id)) {
        next.delete(id);
        changed = true;
      }
    }
    if (changed) firstSeenRef.current = next;
  }, [byId]);

  // 只剩一条时回到直出态。
  useEffect(() => {
    if (schedules.length <= 1) setCollapsed(true);
  }, [schedules.length]);

  if (schedules.length === 0 || sessionId === undefined) return null;

  const next = schedules[0];
  if (next === undefined) return null;
  const expanded = schedules.length === 1 || !collapsed;

  const handleCancel = (id: string, status?: 'active' | 'paused'): void => {
    setCancelling((current) => new Set(current).add(id));
    // 暂停项：host 只清 sidecar、无会话事件 → 投影不刷新；成功后本地摘掉
    if (status === 'paused') {
      setDismissedPaused((current) => new Set(current).add(id));
    }
    void callCommand(sessionId, deleteLine(id))
      .then((ok) => {
        if (!ok && status === 'paused') {
          // 命令未受理则撤销本地摘除，避免误藏
          setDismissedPaused((current) => {
            const nextSet = new Set(current);
            nextSet.delete(id);
            return nextSet;
          });
        }
      })
      .catch(() => {
        if (status === 'paused') {
          setDismissedPaused((current) => {
            const nextSet = new Set(current);
            nextSet.delete(id);
            return nextSet;
          });
        }
      })
      .finally(() => {
        window.setTimeout(() => {
          setCancelling((current) => {
            const nextSet = new Set(current);
            nextSet.delete(id);
            return nextSet;
          });
        }, 2500);
      });
  };

  /**
   * 用户主动插话（QueueDock「插话发送」语义）：把这条提醒**立即**推给 agent。
   * - 不要求已到点：与 QueueDock 一致，排队中的内容随时可提前送达；成功后出列。
   * - 命令返回 success → 记入 steerDone（短暂展示已发送），server 真实 fold 会自然移除 row。
   * - 返回 error → 在行内展示具体原因（every 暂不支持 / 其他）。
   */
  const handleSteer = (item: ClientSchedule): void => {
    const id = item.id;
    setSteering((current) => new Set(current).add(id));
    setSteerErr((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    void callCommand(sessionId, steerLine(id))
      .then((ok) => {
        if (ok) {
          setSteerDone((current) => new Set(current).add(id));
        } else {
          setSteerErr((current) => new Map(current).set(id, t.editErrNotAccepted));
        }
      })
      .catch(() => {
        setSteerErr((current) => new Map(current).set(id, t.editErrCommandFailed));
      })
      .finally(() => {
        setSteering((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      });
  };

  const handlePause = (item: ClientSchedule): void => {
    const id = item.id;
    if (!canPause(item, now)) return;
    setPausing((current) => new Set(current).add(id));
    setPauseErr((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    void callCommand(sessionId, pauseLine(id))
      .then((ok) => {
        if (!ok) {
          setPauseErr((current) => new Map(current).set(id, t.editErrNotAccepted));
        }
      })
      .catch(() => {
        setPauseErr((current) => new Map(current).set(id, t.editErrCommandFailed));
      })
      .finally(() => {
        setPausing((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      });
  };

  const handleResume = (item: ClientSchedule): void => {
    const uid = item.id;
    setResuming((current) => new Set(current).add(uid));
    setPauseErr((current) => {
      const next = new Map(current);
      next.delete(uid);
      return next;
    });
    void callCommand(sessionId, resumeLine(uid))
      .then((ok) => {
        if (!ok) {
          setPauseErr((current) => new Map(current).set(uid, t.editErrNotAccepted));
        }
      })
      .catch(() => {
        setPauseErr((current) => new Map(current).set(uid, t.editErrCommandFailed));
      })
      .finally(() => {
        setResuming((current) => {
          const next = new Set(current);
          next.delete(uid);
          return next;
        });
      });
  };

  const startEdit = (item: ClientSchedule): void => {
    setEditingId(item.id);
    setEditingText(item.prompt);
    setEditErr(null);
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setEditErr(null);
    setSaving(false);
  };

  const submitEdit = (id: string): void => {
    const trimmed = editingText.trim();
    if (trimmed.length === 0) {
      setEditErr(t.editErrEmpty);
      return;
    }
    setSaving(true);
    setEditErr(null);
    void callCommand(sessionId, editLine(id, trimmed)).then((ok) => {
      if (!ok) setEditErr(format(t.editErrFailed, { message: t.editErrNotAccepted }));
      else cancelEdit();
    }).catch(() => {
      setEditErr(format(t.editErrFailed, { message: t.editErrCommandFailed }));
    }).finally(() => setSaving(false));
  };

  const renderRow = (item: ClientSchedule): JSX.Element => {
    const epoch = Date.parse(item.scheduled_at);
    const state = epoch <= now ? 'overdue' : 'scheduled';
    if (editingId === item.id) {
      return (
        <li key={item.id} className="ss-dock-row ss-editing" data-ss-dock-row={item.id}>
          <input
            className="ss-dock-edit-input"
            value={editingText}
            maxLength={1000}
            autoFocus
            disabled={saving}
            onChange={(event) => setEditingText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitEdit(item.id);
              else if (event.key === 'Escape') cancelEdit();
              event.stopPropagation();
            }}
            aria-label={`${t.editTask}: ${item.prompt}`}
          />
          <button
            type="button"
            className="ss-dock-row-save"
            disabled={saving || editingText.trim().length === 0}
            onClick={() => submitEdit(item.id)}
          >
            {saving ? '…' : t.editSave}
          </button>
          <button type="button" className="ss-dock-action" onClick={cancelEdit} aria-label={t.editCancel}>
            ✕
          </button>
          {editErr !== null && <span className="ss-dock-edit-err">{editErr}</span>}
        </li>
      );
    }
    const isPaused = item.status === 'paused';
    const frozenLeft = isPaused
      ? (item.remaining_seconds ?? 0) * 1000
      : epoch - now;
    const countdownText = isPaused
      ? t.pausedLabel
      : state === 'overdue'
        ? t.dueAnyMoment
        : `${t.countdownLeft} ${formatCountdown(Math.max(0, frozenLeft))}`;
    return (
      <li
        key={item.id}
        className={`ss-dock-row${isPaused ? ' ss-paused' : ''}`}
        data-ss-dock-row={item.id}
      >
        <div className="ss-dock-preview">
          <div className="ss-dock-row-line">
            <span className="ss-dock-row-time">{formatHhmm(epoch, detectTimeZone())}</span>
            <span className={`ss-dock-row-countdown${!isPaused && state === 'overdue' ? ' ss-due' : ''}${isPaused ? ' ss-paused-label' : ''}`}>
              {countdownText}
            </span>
            <span className="ss-dock-row-prompt" title={item.prompt}>{item.prompt}</span>
          </div>
          <MultiBar item={item} now={now} firstSeen={firstSeenRef.current} t={t} frozen={isPaused} frozenLeftMs={frozenLeft} />
          {(steerErr.get(item.id) ?? pauseErr.get(item.id)) !== undefined && (
            <span className="ss-dock-steer-err">{steerErr.get(item.id) ?? pauseErr.get(item.id)}</span>
          )}
        </div>
        {/* 图标：编辑 → 暂停/恢复 → 删除 → 插话（暂停保留槽位宽度） */}
        <div className="ss-dock-actions">
          <button
            type="button"
            className="ss-dock-action"
            title={t.editTask}
            aria-label={t.editTask}
            disabled={isPaused}
            onClick={() => startEdit(item)}
          >
            <QueueEditIcon />
          </button>
          {isPaused ? (
            <button
              type="button"
              className={`ss-dock-action ss-paused-active${resuming.has(item.id) ? ' ss-pending' : ''}`}
              title={t.resumeTask}
              aria-label={t.resumeTask}
              disabled={resuming.has(item.id)}
              onClick={() => handleResume(item)}
            >
              <QueueResumeIcon />
            </button>
          ) : (
            <button
              type="button"
              className={`ss-dock-action${pausing.has(item.id) ? ' ss-pending' : ''}`}
              title={canPause(item, now) ? t.pauseTask : t.pauseUnsupportedKind}
              aria-label={canPause(item, now) ? t.pauseTask : t.pauseUnsupportedKind}
              disabled={!canPause(item, now) || pausing.has(item.id)}
              onClick={() => handlePause(item)}
            >
              <QueuePauseIcon />
            </button>
          )}
          <button
            type="button"
            className="ss-dock-action"
            title={t.deleteTask}
            aria-label={t.deleteTask}
            onClick={() => handleCancel(item.id, isPaused ? 'paused' : 'active')}
          >
            <QueueDeleteIcon />
          </button>
          {item.kind !== 'every' && (
            <button
              type="button"
              className={`ss-dock-action ss-dock-action-steer${steering.has(item.id) ? ' ss-pending' : ''}${steerDone.has(item.id) ? ' ss-done' : ''}`}
              title={steerDone.has(item.id) ? t.steerAlreadySent : t.steerTask}
              aria-label={steerDone.has(item.id) ? t.steerAlreadySent : t.steerTask}
              disabled={isPaused || steering.has(item.id) || steerDone.has(item.id)}
              onClick={() => handleSteer(item)}
            >
              <QueueSendIcon />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="ss-dock-root" data-ss-dock="">
      <div className="ss-dock-body">
        {schedules.length > 1 && (
          <button
            type="button"
            className="ss-dock-header"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span className="ss-dock-lead" aria-hidden="true">
              <QueueClockIcon />
            </span>
            <span className="ss-dock-count">{format(t.panelCount, { n: schedules.length })}</span>
            <span className={expanded ? 'ss-dock-chevron ss-open' : 'ss-dock-chevron'} aria-hidden="true">
              <QueueChevronIcon />
            </span>
          </button>
        )}
        {expanded && <ul className="ss-dock-list">{schedules.map(renderRow)}</ul>}
      </div>
    </div>
  );
}

/** Boss 血条：单根长管 + 等比分隔线（每段代表 1h，刻度仅作视觉分隔）。
 *  - `.ss-dock-bar`：进度容器（轨道 + 填充）
 *  - `.ss-dock-bar-fill`：实际进度，按 totalRatio 收缩
 *  - `.ss-dock-bar-divider`：覆盖在最上层的等比分隔线，1 根 element 内画 N-1 条竖线，
 *    避免被前景 fill 遮挡（之前用 background-image 被 fill 完全遮住，看不见）。
 */
function MultiBar({
  item,
  now,
  firstSeen,
  t,
  frozen = false,
  frozenLeftMs,
}: {
  item: ClientSchedule;
  now: number;
  firstSeen: ReadonlyMap<string, number>;
  t: SchedStrings;
  frozen?: boolean;
  frozenLeftMs?: number;
}): JSX.Element {
  const { totalRatio, count } = frozen
    ? frozenBarSegments(item, frozenLeftMs ?? 0, firstSeen)
    : barSegments(item, now, firstSeen);
  return (
    <div
      className={`ss-dock-bars${count > 4 ? ' ss-dock-bars-compact' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(totalRatio * 100)}
      aria-label={t.panelTitle}
    >
      <div className="ss-dock-bar">
        {/* 分隔线先画：跨整个 bar、画 N-1 条等比分隔；fill 之后用 z-index 盖住「已填充段」上的分隔线，只剩「轨道段」上可见刻度 */}
        {count > 1 && (
          <div
            className="ss-dock-bar-divider"
            style={{
              backgroundImage:
                `repeating-linear-gradient(to right, transparent 0, transparent calc((100% - 1px) / ${count}), var(--ss-bar-divider, rgba(0,0,0,0.45)) calc((100% - 1px) / ${count}), var(--ss-bar-divider, rgba(0,0,0,0.45)) calc(100% / ${count}))`,
            }}
          />
        )}
        <div className="ss-dock-bar-fill" style={{ width: `${totalRatio * 100}%` }} />
      </div>
    </div>
  );
}

/* ==================== QueueDock 同款图标（path 逐字取自 dsh-client-ui-conversation） ==================== */

/** 时钟（折叠头 lead，14×14）。 */
function QueueClockIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7.00049 0.199829C3.24488 0.199829 0.199952 3.24408 0.199707 6.99963C0.199707 8.0414 0.434087 9.03061 0.854004 9.91467L1.11279 10.4576L2.19775 9.94202L1.94092 9.39905L1.81787 9.12268C1.5498 8.46885 1.40186 7.75171 1.40186 6.99963C1.4021 3.90808 3.90888 1.40198 7.00049 1.40198C10.0919 1.40219 12.5979 3.90821 12.5981 6.99963C12.5981 10.0913 10.0921 12.5981 7.00049 12.5983C6.36734 12.5983 5.90348 12.5535 5.49268 12.4401C5.08803 12.3283 4.7041 12.1414 4.24463 11.8209C3.57111 11.3511 2.60588 11.1855 1.81006 11.6881L1.79736 11.6959L1.78467 11.7047L1.25537 12.0778L1.65381 13.2672L2.46045 12.6989C2.75029 12.5214 3.18004 12.5442 3.55615 12.8063C4.10063 13.1861 4.60863 13.4423 5.17334 13.5983C5.73194 13.7525 6.31665 13.8004 7.00049 13.8004C10.7561 13.8002 13.8003 10.7553 13.8003 6.99963C13.8 3.24421 10.7559 0.200041 7.00049 0.199829ZM3.81201 7.47327V8.67542H7.11572V7.47327H3.81201ZM3.81201 6.34924H10.2173V5.14709H3.81201V6.34924Z" fill="currentColor" />
    </svg>
  );
}

/** 下箭头 chevron（折叠头，展开时外层 rotate(180deg)，14×14）。 */
function QueueChevronIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor" />
    </svg>
  );
}

/** 铅笔「编辑」（16×16）。 */
function QueueEditIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9.94076 1.34942C10.7047 0.90231 11.6503 0.902415 12.4143 1.34942C12.7061 1.52015 12.9688 1.79118 13.3104 2.13284C13.6521 2.47448 13.9231 2.73721 14.0939 3.02894C14.5408 3.79294 14.5409 4.73856 14.0939 5.50251C13.9231 5.79415 13.652 6.05704 13.3104 6.39861L6.65932 13.0497C6.28068 13.4284 6.00695 13.7108 5.66543 13.9097C5.32391 14.1085 4.94315 14.2074 4.42705 14.3498L3.24394 14.6761C2.77527 14.8054 2.34538 14.9262 2.00131 14.9684C1.65196 15.0112 1.17964 15.0013 0.810764 14.6325C0.441921 14.2637 0.432107 13.7913 0.47486 13.442C0.517035 13.0979 0.6379 12.668 0.767181 12.1993L1.09352 11.0162C1.23588 10.5001 1.33481 10.1193 1.5336 9.77784C1.7325 9.43632 2.0149 9.1626 2.39355 8.78395L9.04466 2.13284C9.38625 1.79126 9.64911 1.52016 9.94076 1.34942ZM15.5427 14.8398H7.55223L8.96707 13.425H15.5427V14.8398ZM3.39382 9.78422C2.965 10.213 2.84244 10.3436 2.75709 10.49C2.67183 10.6366 2.61862 10.8079 2.45733 11.3925L2.13099 12.5756C2.00183 13.0439 1.92194 13.3419 1.88863 13.5536C2.10041 13.5204 2.39872 13.4416 2.86764 13.3123L4.05075 12.9859C4.63544 12.8246 4.80669 12.7715 4.95323 12.6862C5.09968 12.6008 5.23022 12.4783 5.65905 12.0494L10.721 6.98644L8.45577 4.72121L3.39382 9.78422ZM11.7 2.57079C11.3774 2.38198 10.9777 2.38198 10.6551 2.57079C10.5602 2.62647 10.4487 2.72931 10.0449 3.13311L9.45604 3.72094L11.7213 5.98617L12.3102 5.39833C12.7139 4.99457 12.8168 4.88307 12.8725 4.78818C13.0613 4.46561 13.0612 4.06585 12.8725 3.74326C12.8169 3.64827 12.7146 3.53752 12.3102 3.13311C11.9057 2.72863 11.795 2.6264 11.7 2.57079Z" fill="currentColor" />
    </svg>
  );
}

/** 垃圾桶「删除」（16×16）。 */
function QueueDeleteIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z" fill="currentColor" />
    </svg>
  );
}

/** 上箭头「插话发送」（14×14）。 */
function QueueSendIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7.24707 1.01771C7.52897 1.07653 7.77619 1.19694 8.00391 1.38001C8.19202 1.53136 8.39884 1.73784 8.61914 1.95814L12.6396 5.9806L11.6299 6.99134L7.71484 3.0763V13.0001H6.28516V3.0763L2.36914 6.99134L1.35938 5.9806L5.38086 1.95814C5.60116 1.73784 5.80798 1.53136 5.99609 1.38001C6.19476 1.22027 6.4385 1.06739 6.75195 1.01771C6.91296 0.992304 7.07471 0.997504 7.24707 1.01771Z" fill="currentColor" />
    </svg>
  );
}

/** 暂停「⏸」（16×16）。 */
function QueuePauseIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3.6" y="2.6" width="3.2" height="10.8" rx="1.1" fill="currentColor" />
      <rect x="9.2" y="2.6" width="3.2" height="10.8" rx="1.1" fill="currentColor" />
    </svg>
  );
}

/** 恢复「▶」（16×16）。 */
function QueueResumeIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.4 2.9c0-.6.66-1 1.18-.68l7.1 4.1c.52.3.52 1.06 0 1.36l-7.1 4.1A.8.8 0 0 1 4.4 11.1V2.9Z" fill="currentColor" />
    </svg>
  );
}
