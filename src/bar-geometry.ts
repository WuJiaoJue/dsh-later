/**
 * 进度条几何：活动期与暂停冻结期**共用同一套时间基准**。
 *
 * 为什么要单独成模块并写清楚：进度条在「活动 ↔ 暂停 ↔ 恢复」之间切换时，
 * 稍有不一致就会让用户看到条长跳变。历史上有两类真实缺陷：
 *
 *  1. 两套基准：冻结比曾由 `remaining_seconds`（整数秒、ceil）反推，与活动期
 *     精确 ms 的 `now` 恒差一个取整 → 非整秒暂停必然变长。
 *  2. 两个时刻：`paused_at` 是**宿主**处理暂停命令的时刻，比用户点下暂停时最后
 *     渲染的那一帧晚（命令通道往返，实测约 0.3–0.5s）。直接用它做冻结帧，条长
 *     会比前一帧更长 → 「点暂停，条忽然变长」。
 *
 * 现在统一为：`barWindow()` 求窗口，冻结帧只把 `now` 换成冻结时刻，并把冻结
 * 时刻**钳到 ≤ 客户端已渲染时刻**。因此暂停瞬间条长与点击前严格一致。
 *
 * 本模块被 host 与 client 两侧共用（与 command-outcome / smart-window /
 * time-utils 同款：同时列出在 tsconfig.json 与 tsconfig.client.json 的 include 中）。
 *
 * @module dsh-later/bar-geometry
 */

/** 每根进度条代表的时长（1 小时 = 一根满管）。 */
export const BAR_UNIT_MS = 3_600_000;

/** 参与几何计算的 schedule 最小视图（与 client `ClientSchedule` 结构兼容）。 */
export interface BarScheduleView {
  readonly id: string;
  readonly kind: 'after' | 'at' | 'every';
  readonly scheduled_at: string;
  readonly after_seconds?: number;
  readonly every_seconds?: number;
  readonly created_at?: string;
  /** 进度条总窗口（秒）；resume 后 after_seconds 只是剩余，此字段保留原间隔。 */
  readonly window_seconds?: number;
  readonly paused_at?: string;
}

/**
 * 推导进度条起点与总窗口（暂停/活动期共用同一套时间基准）。
 * - `after`：`window_seconds`（resume 后保留的原间隔）→ `after_seconds` → `created_at` → 首见时刻
 * - `every`：`every_seconds` 反推
 * - 其余：`created_at` → 首见时刻
 */
export function barWindow(
  item: BarScheduleView,
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

/** 在给定时刻求进度比与分段数（elapsed 钳在 [0, total]）。 */
function ratioAt(
  item: BarScheduleView,
  at: number,
  firstSeen: ReadonlyMap<string, number>,
): { readonly totalRatio: number; readonly count: number } {
  const end = Date.parse(item.scheduled_at);
  const { start, totalMs } = barWindow(item, end, at, firstSeen);
  const elapsedMs = Math.min(Math.max(at - start, 0), totalMs);
  return {
    totalRatio: elapsedMs / totalMs,
    count: Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS)),
  };
}

/** 活动期进度比：elapsed / total。 */
export function barSegments(
  item: BarScheduleView,
  now: number,
  firstSeen: ReadonlyMap<string, number>,
): { readonly totalRatio: number; readonly count: number } {
  return ratioAt(item, now, firstSeen);
}

/**
 * 暂停冻结进度比。
 *
 * ⚠️ 关键：**不能用 `scheduled_at` 反推**。暂停后 wire 的 `scheduled_at` 会从
 * 「resume 后的新目标」换成 `originalScheduledAt`（原目标），而 `window_seconds`
 * 始终是原窗口。若沿用活动期那套 `end - window` 的算法，暂停瞬间窗口基准整体
 * 跳变，条长会剧烈塌缩（实测 25.7% → 3.3%）。
 *
 * 因此冻结帧改成**自洽的纯算术**，不依赖任何可能变义的字段：
 *   ratio = (window - remaining) / window
 * 其中 window 取 `window_seconds ?? after_seconds`，remaining 取
 * `max(0, frozenLeftMs)`（即 `remaining_seconds * 1000`）。
 *
 * 这样冻结比例天然等于「暂停那一刻已经过掉的部分」，与暂停前后用的是同一个
 * 窗口；`paused_at` 只用于可选的上界钳制（见 `renderedAt`）。
 *
 * @param frozenLeftMs - 冻结剩余毫秒（`remaining_seconds * 1000`）。
 * @param renderedAt - 可选：客户端已渲染过的最新时刻上界；提供且早于暂停时刻时，
 *   按该上界折算，保证冻结帧不超过用户已看到的进度。
 */
export function frozenBarSegments(
  item: BarScheduleView,
  frozenLeftMs: number,
  firstSeen: ReadonlyMap<string, number>,
  renderedAt?: number,
): { readonly totalRatio: number; readonly count: number } {
  const windowSec = item.window_seconds ?? item.after_seconds;
  if (windowSec === undefined || windowSec <= 0) {
    // 兜底：信息不足时退回按 scheduled_at 推算（旧行为）
    const end = Date.parse(item.scheduled_at);
    const pausedAt = Date.parse(item.paused_at ?? '');
    const exact = Number.isNaN(pausedAt)
      ? end - Math.floor(frozenLeftMs / 1000) * 1000
      : pausedAt;
    return ratioAt(item, Number.isNaN(exact) ? end : exact, firstSeen);
  }
  const totalMs = Math.max(1000, windowSec * 1000);
  // 剩余时间不得为负；也不得超过窗口（避免脏数据把条拉爆）
  let leftMs = Math.min(Math.max(frozenLeftMs, 0), totalMs);
  // 上界钳制：宿主 `paused_at` 是命令到达时刻，比用户点击晚（往返耗时 Δ）。
  // 若提供了「客户端已渲染时刻」且 paused_at 更晚，则把冻结剩余**补回** Δ，
  // 使冻结帧等于暂停前最后一帧，而不是凭空多走一截。
  const pausedAt = Date.parse(item.paused_at ?? '');
  if (renderedAt !== undefined && !Number.isNaN(pausedAt) && pausedAt > renderedAt) {
    leftMs = Math.min(leftMs + (pausedAt - renderedAt), totalMs);
  }
  const elapsedMs = Math.min(Math.max(totalMs - leftMs, 0), totalMs);
  return {
    totalRatio: elapsedMs / totalMs,
    count: Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS)),
  };
}
