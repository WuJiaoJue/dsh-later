/**
 * 侧栏「定时状态」badge 的纯逻辑（宿主与客户端共享）。
 *
 * 数据源说明（路线 B 的关键事实）：本插件的 `userSchedules` 投影是
 * client-visible 单元，宿主在 `session.list` 基线里为**每个**会话携带
 * projections 块（live 会话走注册表现值，冷会话走持久化投影缓存，零日志
 * 加载）；客户端把每行的块喂进 per-session 投影 store，并合入
 * `SessionSummary.projectionValues`。因此客户端从 `sessions.list` 就能拿到
 * 跨会话的任务概要，**无需宿主新增任何数据通道**。
 *
 * 本模块不触碰 DOM / React，全部函数可在 node --test 下运行。
 * @module dsh-later/presence
 */

/** badge 状态：正常排期 / 紧急（≤5min）/ 到期未派发（瞬时，等会话空闲）。 */
export type PresenceBadgeState = 'scheduled' | 'urgent' | 'overdue';

/** 紧急窗口：下次触发在该窗口内时，badge 从 scheduled 升级为 urgent。 */
export const PRESENCE_URGENT_WINDOW_MS = 5 * 60_000;

/** 参与归纳的最小任务形状（投影 wire 项 / runtime 记录的超集）。 */
export interface PresenceScheduleLike {
  readonly scheduled_at?: string;
  readonly scheduledAt?: string;
}

/** 由一组活动任务归纳的 badge 概要。 */
export interface PresenceSummary {
  /** 可解析触发时刻的活动任务数量。 */
  readonly count: number;
  /** 最早触发时刻（epoch ms）；全部不可解析时缺省。 */
  readonly nextAt?: number;
}

/**
 * 归纳：取最早触发时刻 + 可解析数量。`every` 类任务在投影里携带推进后的
 * `scheduledAt`（下次触发点），与一次性任务同构参与排序。
 */
export function summarizeSchedules(schedules: readonly PresenceScheduleLike[] | undefined): PresenceSummary {
  let nextAt: number | undefined;
  let count = 0;
  for (const item of schedules ?? []) {
    const raw = item.scheduled_at ?? item.scheduledAt;
    if (raw === undefined) continue;
    const epoch = Date.parse(raw);
    if (!Number.isFinite(epoch)) continue;
    count += 1;
    if (nextAt === undefined || epoch < nextAt) nextAt = epoch;
  }
  return nextAt === undefined ? { count: 0 } : { count, nextAt };
}

/** 由当前时刻判定 badge 状态。 */
export function badgeStateFor(nextAt: number | undefined, now: number): PresenceBadgeState {
  if (nextAt === undefined) return 'scheduled';
  const diff = nextAt - now;
  if (diff <= 0) return 'overdue';
  if (diff <= PRESENCE_URGENT_WINDOW_MS) return 'urgent';
  return 'scheduled';
}

/**
 * 悬浮卡片状态行的完整文案（与宿主 `.hoverStatus` 行同构：一个状态点 + 一句
 * 描述）。宿主的状态链对定时任务无感知，本插件**只追加**这样一行，不改写也
 * 不替换宿主已有的 `空闲` / `进行中` 等行，因此既有状态优先级天然不变。
 *
 * @param entry - 该会话的定时概要（调用方保证 count > 0）。
 * @param now - 当前时刻（epoch ms），用于判定 overdue 与相对时间。
 * @param labels - 相对时间文案槽位。
 * @param strings - 当前语言的字典。
 * @param formatHhmm - 时钟面格式化（注入以便单测）。
 * @param formatDate - 日期面格式化（注入以便单测）。
 * @returns 状态文案 + 视觉状态（`done` 为中性信息态，与宿主同款状态点）。
 */
export function hoverScheduleStatus(
  entry: PresenceSummary,
  now: number,
  labels: RelativeFireLabels,
  strings: { readonly hoverScheduleStatus: string; readonly hoverScheduleOverdue: string },
  formatHhmm: (epoch: number) => string,
  formatDate: (epoch: number) => string,
): { readonly label: string; readonly tone: PresenceBadgeState } {
  const tone = badgeStateFor(entry.nextAt, now);
  if (tone === 'overdue' || entry.nextAt === undefined) {
    return { label: formatTemplate(strings.hoverScheduleOverdue, { n: entry.count }), tone };
  }
  const time = relativeFireLabel(entry.nextAt, now, labels, formatHhmm, formatDate);
  return { label: formatTemplate(strings.hoverScheduleStatus, { n: entry.count, time }), tone };
}

/** `{name}` 占位符替换（与 client/strings 的 format 同语义；此处零依赖）。 */
function formatTemplate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** 相对触发时间的文案槽位（由调用方按语言准备；时间串经 formatHhmm 注入）。 */
export interface RelativeFireLabels {
  /** ≤1 分钟：即将发送。 */
  readonly imminent: string;
  /** 1–59 分钟：{m} 分后。 */
  readonly minutes: (m: number) => string;
  /** 今天且 ≥1 小时：{h} 小时后。 */
  readonly hours: (h: number) => string;
  /** 明天：明天 {time}。 */
  readonly tomorrow: (time: string) => string;
  /** 已到期 / 更远日期缺省时钟面。 */
  readonly clock: (time: string) => string;
  /** ≥2 天：{date} {time}。 */
  readonly date: (date: string, time: string) => string;
}

function startOfDay(epoch: number): number {
  const d = new Date(epoch);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 下次触发的相对时间标签。已到期（≤0）返回绝对时钟面（overdue 态文案由
 * 调用方另行处理），≤1min 返回「即将发送」，其余按 分/小时/明天/日期 分档。
 */
export function relativeFireLabel(
  nextAt: number,
  now: number,
  labels: RelativeFireLabels,
  formatHhmm: (epoch: number) => string,
  formatDate: (epoch: number) => string,
): string {
  const diff = nextAt - now;
  if (diff <= 0) return labels.clock(formatHhmm(nextAt));
  if (diff <= 60_000) return labels.imminent;
  if (diff < 3_600_000) return labels.minutes(Math.max(1, Math.round(diff / 60_000)));
  const dayDiff = Math.round((startOfDay(nextAt) - startOfDay(now)) / 86_400_000);
  const time = formatHhmm(nextAt);
  if (dayDiff <= 0) return labels.hours(Math.max(1, Math.round(diff / 3_600_000)));
  if (dayDiff === 1) return labels.tomorrow(time);
  return labels.date(formatDate(nextAt), time);
}
