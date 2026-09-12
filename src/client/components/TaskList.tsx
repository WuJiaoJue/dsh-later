/**
 * 任务列表：面板内显示已设定任务（PRD §3.2.2 / docs/ui 01 §4）。
 * 状态点：scheduled 蓝、overdue 橙闪、delivered 绿、cancelled 灰删线。
 * @module dsh-later/client/components/TaskList
 */
import type { JSX } from 'react';
import { formatAbsolute, formatRelative, type TextLocale } from '../../time-utils.js';
import type { ClientSchedule } from '../types.js';
import type { SchedStrings } from '../strings.js';

export interface TaskListProps {
  items: readonly ClientSchedule[];
  /** 本渲染时刻的墙钟（倒计时刷新由上层驱动）。 */
  now: number;
  /** 刚送达（已从投影消失）的 id，绿色 3 秒闪示。 */
  deliveredIds?: ReadonlySet<string>;
  /** 用户刚删除（本地描灰过渡）的 id。 */
  cancellingIds?: ReadonlySet<string>;
  /** 删除单个。 */
  onDelete: (id: string) => void;
  timeZone: string;
  /** 文案字典（跟随宿主 locale）。 */
  t: SchedStrings;
  /** 当前语言 id（时间文案用）。 */
  lang: TextLocale;
}

/** 由 scheduledAt 推导状态。 */
export function scheduleStateOf(item: ClientSchedule, now: number): 'scheduled' | 'overdue' {
  return Date.parse(item.scheduled_at) <= now ? 'overdue' : 'scheduled';
}

export function TaskList({ items, now, deliveredIds, cancellingIds, onDelete, timeZone, t, lang }: TaskListProps): JSX.Element {
  if (items.length === 0) {
    return <div className="ss-empty" data-ss-empty="">{t.emptyTasks}</div>;
  }
  return (
    <ul className="ss-tasks" data-ss-tasks="">
      {items.map((item) => {
        const dotState: 'scheduled' | 'overdue' | 'delivered' | 'cancelled' =
          deliveredIds?.has(item.id)
            ? 'delivered'
            : cancellingIds?.has(item.id)
              ? 'cancelled'
              : scheduleStateOf(item, now);
        const isCancelled = dotState === 'cancelled';
        return (
          <li key={item.id} className={isCancelled ? 'ss-task cancelled' : 'ss-task'} data-ss-task={item.id}>
            <span className={`ss-dot ${dotState}`} aria-hidden="true" />
            <span className="ss-task-main">
              <span className="ss-task-time">
                {formatAbsolute(Date.parse(item.scheduled_at), timeZone, lang)} · {formatRelative(Date.parse(item.scheduled_at), now, lang)}
              </span>
              <br />
              <span className="ss-task-prompt">{item.prompt}</span>
            </span>
            <button
              type="button"
              className="ss-task-del"
              title={t.deleteTask}
              aria-label={`${t.deleteTask}: ${item.prompt}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(item.id);
              }}
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
