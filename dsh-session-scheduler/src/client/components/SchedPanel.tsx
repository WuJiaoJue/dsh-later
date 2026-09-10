/**
 * 定时配置面板（精简单视图）。
 *
 * 结构：标题 → 快捷芯片（相对时长 / 固定时刻 / 自定义展开）→ 已设定任务 → 确认。
 * 内容直接取输入框草稿（PRD 本意：发送当前输入内容），无独立 textarea、
 * 无预览块、无时区选择（自动检测）、无静态时段展示。
 * @module dsh-session-scheduler/client/components/SchedPanel
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { epochFromLocal, localFieldsOf, nextSmartAt, DEFAULT_SMART_WINDOW, type SmartWindowConfig } from '../../smart-window.js';
import type { TextLocale } from '../../time-utils.js';
import { formatAbsolute, formatRelative } from '../../time-utils.js';
import { TaskList } from './TaskList.js';
import { format, CLIENT_ERR, type SchedStrings } from '../strings.js';
import { useNow } from '../useCountdown.js';
import type { ClientAtInput, ClientSchedule, CreateCommandPayload } from '../types.js';

export interface SchedPanelProps {
  /** 当前输入框草稿（作为提醒内容）。 */
  defaultPrompt: string;
  /** 当前已设定任务。 */
  schedules: readonly ClientSchedule[];
  timeZone: string;
  busy: boolean;
  /** 文案字典（跟随宿主 locale，由 SchedButton 传入）。 */
  t: SchedStrings;
  /** 当前语言 id（时间文案用）。 */
  lang: TextLocale;
  /** AC-06：草稿变更自动取消的任务 id 集合。 */
  onClose: () => void;
  onCreate: (input: CreateCommandPayload) => Promise<void>;
  onDelete: (id: string) => void;
  /** 父组件提供的底部定位（相对视口），用于把面板浮在输入行上方。 */
  bottom: number;
  /** 智能时段配置（设置页实时值，已清洗；缺省用内置默认）。 */
  smartWindow?: SmartWindowConfig;
  /** 提示字符上限（设置页实时值；缺省回退 1000）。 */
  promptLimits?: { readonly maxChars: number; readonly allowLong: boolean };
}

/** 一个快捷选项：相对时长（after_seconds）或固定时刻（at）。 */
type QuickOption =
  | { readonly kind: 'after'; readonly seconds: number; readonly label: string }
  | { readonly kind: 'at'; readonly at: ClientAtInput; readonly epoch: number; readonly label: string }
  | { readonly kind: 'smart'; readonly at: ClientAtInput; readonly epoch: number; readonly label: string }
  | { readonly kind: 'custom'; readonly label: string };

/** 今天/明天某时刻的 at 对象。 */
function atOnDay(dayOffset: number, hhmm: string, timeZone: string, now: number): { at: ClientAtInput; epoch: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (match === null) return null;
  const fields = localFieldsOf(now + dayOffset * 24 * 3600 * 1000, timeZone);
  const date = `${String(fields.year).padStart(4, '0')}-${String(fields.month).padStart(2, '0')}-${String(fields.day).padStart(2, '0')}`;
  const epoch = epochFromLocal(date, `${hhmm}:00`, timeZone);
  if (epoch === undefined || Number.isNaN(epoch)) return null;
  return { at: { date, time: `${hhmm}:00`, time_zone: timeZone }, epoch };
}

/** 面板主体（受控渲染：父组件负责 open 与定位）。 */
export function SchedPanel({
  defaultPrompt,
  schedules,
  timeZone,
  busy,
  t,
  lang,
  onClose,
  onCreate,
  onDelete,
  bottom,
  smartWindow = DEFAULT_SMART_WINDOW,
  promptLimits,
}: SchedPanelProps): JSX.Element {
  const now = useNow(1000);
  const [selected, setSelected] = useState<string>('after-600');
  const [customDate, setCustomDate] = useState<string>(() => {
    const f = localFieldsOf(Date.now(), timeZone);
    return `${String(f.year).padStart(4, '0')}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
  });
  const [customTime, setCustomTime] = useState<string>('18:00');
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set());
  const [delivered, setDelivered] = useState<ReadonlySet<string>>(new Set());
  const deliveredTimers = useRef<number[]>([]);
  const prevIds = useRef<ReadonlySet<string> | null>(null);

  // 已送达闪显：任务从投影消失时绿点标记 3 秒（排除取消中的）。
  useEffect(() => {
    const currentIds = new Set(schedules.map((item) => item.id));
    const previous = prevIds.current;
    prevIds.current = currentIds;
    if (previous === null) return;
    const gone = [...previous].filter((id) => !currentIds.has(id) && !cancelling.has(id));
    if (gone.length === 0) return;
    setDelivered((existing) => new Set([...existing, ...gone]));
    for (const id of gone) {
      const timer = window.setTimeout(() => {
        setDelivered((existing) => {
          const next = new Set(existing);
          next.delete(id);
          return next;
        });
      }, 3000);
      deliveredTimers.current.push(timer);
    }
  }, [schedules, cancelling ]);

  useEffect(
    () => () => {
      for (const timer of deliveredTimers.current) window.clearTimeout(timer);
    },
    [],
  );

  // 快捷选项（每分钟重算一次足够；直接跟随 now 简单可靠）。
  // 「今天晚间」「明天早上」芯片与智能时段均跟随设置页的实时时段配置。
  const quickOptions = useMemo<QuickOption[]>(() => {
    const options: QuickOption[] = [
      { kind: 'after', seconds: 600, label: t.quick10m },
      { kind: 'after', seconds: 3600, label: t.quick1h },
    ];
    const todayEvening = atOnDay(0, smartWindow.workEnd, timeZone, now);
    if (todayEvening !== null && todayEvening.epoch > now) {
      options.push({ kind: 'at', ...todayEvening, label: `${t.today} ${smartWindow.workEnd}` });
    }
    const tomorrowMorning = atOnDay(1, smartWindow.workStart, timeZone, now);
    if (tomorrowMorning !== null && tomorrowMorning.epoch > now) {
      options.push({ kind: 'at', ...tomorrowMorning, label: `${t.tomorrow} ${smartWindow.workStart}` });
    }
    const smart = nextSmartAt(now, timeZone, smartWindow);
    if (smart !== null) {
      options.push({
        kind: 'smart',
        at: { date: smart.date, time: smart.time, time_zone: smart.time_zone },
        epoch: smart.epoch,
        label: t.quickSmart,
      });
    }
    options.push({ kind: 'custom', label: t.quickCustom });
    return options;
  }, [timeZone, now, t, smartWindow]);

  // 当前选中的目标（custom 分支单独计算）。
  const target = useMemo<{ at?: ClientAtInput; after_seconds?: number; epoch: number } | null>(() => {
    if (selected === 'custom') {
      const match = /^(\d{2}):(\d{2})$/.exec(customTime);
      if (match === null) return null;
      const epoch = epochFromLocal(customDate, `${customTime}:00`, timeZone);
      if (epoch === undefined || Number.isNaN(epoch) || epoch <= now) return null;
      return { at: { date: customDate, time: `${customTime}:00`, time_zone: timeZone }, epoch };
    }
    const option = quickOptions.find((item) => keyOf(item) === selected);
    if (option === undefined || option.kind === 'custom') return null;
    if (option.kind === 'after') return { after_seconds: option.seconds, epoch: now + option.seconds * 1000 };
    return { at: option.at, epoch: option.epoch };
  }, [selected, customDate, customTime, timeZone, now, quickOptions]);

  const targetLabel = useMemo(() => {
    if (target === undefined || target === null) return null;
    return `${formatAbsolute(target.epoch, timeZone, lang)} · ${formatRelative(target.epoch, now, lang)}`;
  }, [target, timeZone, now]);

  const handleConfirm = async (): Promise<void> => {
    const text = defaultPrompt.trim();
    if (text.length === 0) {
      setError(t.errPromptEmpty);
      return;
    }
    // 与宿主 resolvePromptLimits 对齐的本地预校验（P1-7）：
    // 宿主错误文案不随 locale 变化，能在客户端拦下的就不发往宿主。
    const maxChars = promptLimits?.maxChars ?? 1000;
    if (text.length > maxChars) {
      setError(t.errPromptTooLong);
      return;
    }
    if (target === null) {
      setError(t.errTimePast);
      return;
    }
    setError(null);
    try {
      await onCreate(
        target.at !== undefined
          ? { prompt: text, at: target.at }
          : { prompt: text, after_seconds: target.after_seconds },
      );
      onClose();
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      // hook 抛的是稳定令牌 → 按当前语言翻译；未知内容原样透出。
      const message =
        raw === CLIENT_ERR.NO_SESSION
          ? t.errNoSession
          : raw === CLIENT_ERR.NOT_ACCEPTED
            ? t.errNotAcceptedStashed
            : raw;
      setError(format(t.errCreateFailed, { message }));
    }
  };

  const handleDelete = (id: string): void => {
    setCancelling((current) => new Set(current).add(id));
    try {
      onDelete(id);
    } catch (cause) {
      setError(format(t.errDeleteFailed, { message: cause instanceof Error ? cause.message : String(cause) }));
    }
    window.setTimeout(() => {
      setCancelling((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, 2500);
  };

  const promptEmpty = defaultPrompt.trim().length === 0;
  const canConfirm = !busy && !promptEmpty && target !== null;

  return (
    <div className="ss-panel" data-ss-panel="" role="dialog" aria-label={t.panelTitle} style={{ bottom }}>
      <div className="ss-panel-header">
        <span className="ss-panel-title">{t.panelTitle}</span>
        <button type="button" className="ss-panel-close" aria-label={t.close} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="ss-quick-grid" role="radiogroup" aria-label={t.panelTitle}>
        {quickOptions.map((option) => {
          const key = keyOf(option);
          const active = selected === key || (option.kind === 'custom' && selected === 'custom');
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'ss-quick-chip ss-active' : 'ss-quick-chip'}
              onClick={() => {
                setSelected(key);
                setError(null);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {selected === 'custom' && (
        <div className="ss-custom-row">
          <input
            type="date"
            className="ss-input"
            aria-label={t.dateLabel}
            value={customDate}
            onChange={(event) => {
              if (event.target.value) setCustomDate(event.target.value);
            }}
          />
          <input
            type="time"
            className="ss-input"
            aria-label={t.timeLabel}
            value={customTime}
            onChange={(event) => {
              if (event.target.value) setCustomTime(event.target.value);
            }}
          />
        </div>
      )}

      {target !== null && targetLabel !== null && (
        <div className="ss-hint" style={{ margin: '6px 0 0' }}>{targetLabel}</div>
      )}

      {error !== null && <div className="ss-error" role="alert" style={{ marginTop: 6 }}>{error}</div>}

      <div className="ss-tasklist-head">
        <span className="ss-hint">{t.taskListTitle}{schedules.length > 0 ? ` (${schedules.length})` : ''}</span>
      </div>
      <TaskList
        items={schedules}
        now={now}
        deliveredIds={delivered}
        cancellingIds={cancelling}
        onDelete={handleDelete}
        timeZone={timeZone}
        t={t}
        lang={lang}
      />

      <div className="ss-footer">
        <button
          type="button"
          className="ss-confirm"
          disabled={!canConfirm}
          onClick={() => void handleConfirm()}
        >
          {busy
            ? t.sending
            : target !== null
              ? format(t.confirmAdd, { time: formatAbsolute(target.epoch, timeZone, lang) })
              : t.confirmAddNoTime}
        </button>
      </div>
      {promptEmpty && <div className="ss-hint" style={{ marginTop: 6 }}>{t.promptFromDraft}</div>}
    </div>
  );
}

/** 快捷选项的稳定 key。 */
function keyOf(option: QuickOption): string {
  switch (option.kind) {
    case 'after':
      return `after-${option.seconds}`;
    case 'at':
      return `at-${option.at.date}-${option.at.time}`;
    case 'smart':
      return 'smart';
    case 'custom':
      return 'custom';
  }
}
