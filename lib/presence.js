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
/** 紧急窗口：下次触发在该窗口内时，badge 从 scheduled 升级为 urgent。 */
export const PRESENCE_URGENT_WINDOW_MS = 5 * 60_000;
/**
 * 归纳：取最早触发时刻 + 可解析数量。`every` 类任务在投影里携带推进后的
 * `scheduledAt`（下次触发点），与一次性任务同构参与排序。
 */
export function summarizeSchedules(schedules) {
    let nextAt;
    let count = 0;
    for (const item of schedules ?? []) {
        const raw = item.scheduled_at ?? item.scheduledAt;
        if (raw === undefined)
            continue;
        const epoch = Date.parse(raw);
        if (!Number.isFinite(epoch))
            continue;
        count += 1;
        if (nextAt === undefined || epoch < nextAt)
            nextAt = epoch;
    }
    return nextAt === undefined ? { count: 0 } : { count, nextAt };
}
/** 由当前时刻判定 badge 状态。 */
export function badgeStateFor(nextAt, now) {
    if (nextAt === undefined)
        return 'scheduled';
    const diff = nextAt - now;
    if (diff <= 0)
        return 'overdue';
    if (diff <= PRESENCE_URGENT_WINDOW_MS)
        return 'urgent';
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
export function hoverScheduleStatus(entry, now, labels, strings, formatHhmm, formatDate) {
    const tone = badgeStateFor(entry.nextAt, now);
    if (tone === 'overdue' || entry.nextAt === undefined) {
        return { label: formatTemplate(strings.hoverScheduleOverdue, { n: entry.count }), tone };
    }
    const time = relativeFireLabel(entry.nextAt, now, labels, formatHhmm, formatDate);
    return { label: formatTemplate(strings.hoverScheduleStatus, { n: entry.count, time }), tone };
}
/** `{name}` 占位符替换（与 client/strings 的 format 同语义；此处零依赖）。 */
function formatTemplate(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, key) => key in params ? String(params[key]) : match);
}
function startOfDay(epoch) {
    const d = new Date(epoch);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}
/**
 * 下次触发的相对时间标签。已到期（≤0）返回绝对时钟面（overdue 态文案由
 * 调用方另行处理），≤1min 返回「即将发送」，其余按 分/小时/明天/日期 分档。
 */
export function relativeFireLabel(nextAt, now, labels, formatHhmm, formatDate) {
    const diff = nextAt - now;
    if (diff <= 0)
        return labels.clock(formatHhmm(nextAt));
    if (diff <= 60_000)
        return labels.imminent;
    if (diff < 3_600_000)
        return labels.minutes(Math.max(1, Math.round(diff / 60_000)));
    const dayDiff = Math.round((startOfDay(nextAt) - startOfDay(now)) / 86_400_000);
    const time = formatHhmm(nextAt);
    if (dayDiff <= 0)
        return labels.hours(Math.max(1, Math.round(diff / 3_600_000)));
    if (dayDiff === 1)
        return labels.tomorrow(time);
    return labels.date(formatDate(nextAt), time);
}
