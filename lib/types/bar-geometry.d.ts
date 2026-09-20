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
export declare const BAR_UNIT_MS = 3600000;
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
export declare function barWindow(item: BarScheduleView, end: number, now: number, firstSeen: ReadonlyMap<string, number>): {
    readonly start: number;
    readonly totalMs: number;
};
/** 活动期进度比：elapsed / total。 */
export declare function barSegments(item: BarScheduleView, now: number, firstSeen: ReadonlyMap<string, number>): {
    readonly totalRatio: number;
    readonly count: number;
};
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
export declare function frozenBarSegments(item: BarScheduleView, frozenLeftMs: number, firstSeen: ReadonlyMap<string, number>, renderedAt?: number): {
    readonly totalRatio: number;
    readonly count: number;
};
