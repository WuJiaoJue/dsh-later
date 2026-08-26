/**
 * 待发送提醒 dock（呈现对齐 DSH QueueDock）。
 *
 * 位置：输入框上方 dock 区（conversation.input.dock，与排队消息同区）。
 * 行为：
 *  - 空列表不渲染
 *  - 单条：直接显示 内容 + 时间 + 单独取消/修改
 *  - 多条：折叠为「数量 header + 下一条预览」，点击展开列表（max-height 180px）
 *  - 每条可单独取消；可点击编辑图标进入行内修改内容（保留原时刻）
 * @module dsh-session-scheduler/client/components/ScheduleDock
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { detectTimeZone, formatHhmm } from '../../time-utils.js';
import { strings, format } from '../strings.js';
import { useNow } from '../useCountdown.js';
import { showReminderToast } from '../toast.jsx';
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
 * 多管进度计算（boss 血条式分段，但视觉保持细条风格）：
 *  - 总时长 = 触发时刻 − 起点；管数 = ceil(总时长 / 1h)，最少 1 根
 *  - 起点：`after`/`every` 用间隔反推；`at` 用 created_at（create 事件固化），
 *    都没有时回退客户端首见时刻
 *  - 返回每根管的填充比例（前段可能 100%，中段一段渐进，尾段 0%）
 */
function barSegments(
  item: ClientSchedule,
  now: number,
  firstSeen: ReadonlyMap<string, number>,
): readonly number[] {
  const end = Date.parse(item.scheduled_at);
  let start: number;
  if (item.kind === 'after' && item.after_seconds !== undefined) {
    start = end - item.after_seconds * 1000;
  } else if (item.kind === 'every' && item.every_seconds !== undefined) {
    start = end - item.every_seconds * 1000;
  } else if (item.created_at !== undefined) {
    const parsed = Date.parse(item.created_at);
    start = Number.isNaN(parsed) ? (firstSeen.get(item.id) ?? now) : parsed;
  } else {
    start = firstSeen.get(item.id) ?? now;
  }
  const totalMs = Math.max(1000, end - start);
  const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
  const count = Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS));
  const segments: number[] = [];
  for (let i = 0; i < count; i++) {
    const segStart = i * BAR_UNIT_MS;
    const segEnd = Math.min((i + 1) * BAR_UNIT_MS, totalMs);
    segments.push(Math.min(1, Math.max(0, (elapsedMs - segStart) / Math.max(1, segEnd - segStart))));
  }
  return segments;
}

/** 应用层注入的调用能力。 */
export interface ScheduleDockInjected {
  /** 向宿主执行一条 slash 命令；返回是否受理。 */
  callCommand: (sessionId: string, line: string) => Promise<boolean>;
}

/** 会话作用域插槽条目收到的标准 props + 注入。 */
export interface ScheduleDockProps extends ScheduleDockInjected {
  /** 会话作用域标准 hook：读取投影。 */
  useProjection?: (key: string) => { schedules?: readonly ClientSchedule[] } | undefined;
  /** 会话 id。 */
  sessionId?: string;
}

const deleteLine = (id: string): string => `/user-schedule-delete ${JSON.stringify({ id })}`;
const editLine = (id: string, prompt: string): string =>
  `/user-schedule-edit ${JSON.stringify({ id, prompt })}`;

export function ScheduleDock({ callCommand, sessionId, useProjection }: ScheduleDockProps): JSX.Element | null {
  const now = useNow(1000);
  const projection = typeof useProjection === 'function' ? useProjection('userSchedules') : undefined;
  const schedules = useMemo(
    () => [...(projection?.schedules ?? [])].sort(
      (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
    ) as ClientSchedule[],
    [projection],
  );

  const [collapsed, setCollapsed] = useState(true);
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set());
  // 行内编辑状态：正在编辑的 schedule id → 当前输入
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 提醒到达检测：上上次渲染仍存在、本次已消失、且已到触发时刻 → 视为 dispatch。
  // 用户主动取消/编辑造成的消失由 ref 抑制，避免误报。
  const prevRef = useRef<ReadonlyMap<string, ClientSchedule>>(new Map());
  const suppressedRef = useRef<ReadonlySet<string>>(new Set());
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

    const prev = prevRef.current;
    if (prev.size > 0) {
      for (const [id, prevItem] of prev) {
        if (byId.has(id)) continue;
        if (suppressedRef.current.has(id)) continue;
        // 已到时刻才弹（dispatch）；手动删掉仍待发的任务不弹
        if (Date.parse(prevItem.scheduled_at) <= Date.now()) {
          showReminderToast(prevItem.prompt);
        }
      }
    }
    prevRef.current = byId;
  }, [byId]);

  // 触发取消/编辑时，把涉及 id 计入抑制集合，避免被误判为「提醒到达」。
  const suppress = (id: string): void => {
    suppressedRef.current = new Set(suppressedRef.current).add(id);
  };

  // 只剩一条时回到直出态。
  useEffect(() => {
    if (schedules.length <= 1) setCollapsed(true);
  }, [schedules.length]);

  if (schedules.length === 0 || sessionId === undefined) return null;

  const next = schedules[0];
  if (next === undefined) return null;
  const nextEpoch = Date.parse(next.scheduled_at);
  const expanded = schedules.length === 1 || !collapsed;

  const handleCancel = (id: string): void => {
    suppress(id);
    setCancelling((current) => new Set(current).add(id));
    void callCommand(sessionId, deleteLine(id)).finally(() => {
      window.setTimeout(() => {
        setCancelling((current) => {
          const nextSet = new Set(current);
          nextSet.delete(id);
          return nextSet;
        });
      }, 2500);
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
      setEditErr(strings.editErrEmpty);
      return;
    }
    suppress(id);
    setSaving(true);
    setEditErr(null);
    void callCommand(sessionId, editLine(id, trimmed)).then((ok) => {
      if (!ok) setEditErr(format(strings.editErrFailed, { message: '未受理' }));
      else cancelEdit();
    }).catch(() => {
      setEditErr(format(strings.editErrFailed, { message: '命令失败' }));
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
            aria-label={`${strings.editTask}：${item.prompt}`}
          />
          <button
            type="button"
            className="ss-dock-row-save"
            disabled={saving || editingText.trim().length === 0}
            onClick={() => submitEdit(item.id)}
          >
            {saving ? '…' : strings.editSave}
          </button>
          <button type="button" className="ss-dock-row-cancel" onClick={cancelEdit} aria-label={strings.editCancel}>
            ✕
          </button>
          {editErr !== null && <span className="ss-dock-edit-err">{editErr}</span>}
        </li>
      );
    }
    return (
      <li key={item.id} className="ss-dock-row" data-ss-dock-row={item.id}>
        <span className={`ss-dot ${cancelling.has(item.id) ? 'cancelled' : state}`} aria-hidden="true" />
        <div className="ss-dock-row-body">
          <div className="ss-dock-row-line">
            <span className="ss-dock-row-time">{formatHhmm(epoch, detectTimeZone())}</span>
            <span className={`ss-dock-row-countdown${state === 'overdue' ? ' ss-due' : ''}`}>
              {state === 'overdue' ? strings.dueAnyMoment : `${strings.countdownLeft} ${formatCountdown(epoch - now)}`}
            </span>
            <span className="ss-dock-row-prompt" title={item.prompt}>{item.prompt}</span>
          </div>
          <MultiBar item={item} now={now} firstSeen={firstSeenRef.current} />
        </div>
        <button
          type="button"
          className="ss-dock-row-edit"
          title={strings.editTask}
          aria-label={`${strings.editTask}：${item.prompt}`}
          onClick={() => startEdit(item)}
        >
          ✎
        </button>
        <button
          type="button"
          className="ss-dock-row-cancel"
          title={strings.deleteTask}
          aria-label={`${strings.deleteTask}：${item.prompt}`}
          onClick={() => handleCancel(item.id)}
        >
          ✕
        </button>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span className="ss-dock-title">{strings.panelTitle} ({schedules.length})</span>
            <span className="ss-dock-progress">
              {formatHhmm(nextEpoch, detectTimeZone())} · {strings.countdownLeft} {formatCountdown(nextEpoch - now)} · {next.prompt}
            </span>
            <span className={expanded ? 'ss-dock-chevron ss-open' : 'ss-dock-chevron'} aria-hidden="true">⌄</span>
          </button>
        )}
        {expanded && <ul className="ss-dock-list">{schedules.map(renderRow)}</ul>}
      </div>
    </div>
  );
}

/** 多管进度条：每管 1h，纵向堆叠细条（>4 管时自动紧凑）。 */
function MultiBar({
  item,
  now,
  firstSeen,
}: {
  item: ClientSchedule;
  now: number;
  firstSeen: ReadonlyMap<string, number>;
}): JSX.Element {
  const segments = barSegments(item, now, firstSeen);
  const overall = segments.reduce((sum, ratio) => sum + ratio, 0) / segments.length;
  return (
    <div
      className={`ss-dock-bars${segments.length > 4 ? ' ss-dock-bars-compact' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(overall * 100)}
      aria-label={strings.panelTitle}
    >
      {segments.map((ratio, index) => (
        <div key={index} className="ss-dock-bar">
          <div className="ss-dock-bar-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
