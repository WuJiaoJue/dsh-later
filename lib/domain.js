/** 插件名（与 cordis 条目 id / manifest 一致）。 */
export const name = 'dsh-later';
/** 会话投影键：GUI 通过 `useProjection` / `faceOf` 读取用户任务列表。 */
export const PROJECTION_KEY = 'userSchedules';
/**
 * 伴生所有权事件类型（**历史遗留，仅读兼容**；新写入一律走 ownership-store）。
 * 字面量保留旧名 `session-scheduler/user-schedule`：它是历史会话日志里的
 * 数据键，改名不追溯——读方必须继续认它。
 */
export const OWNED_EVENT = 'session-scheduler/user-schedule';
/** 判断事件是否属于本插件所有权流。 */
export function isOwnedEvent(event) {
    return event.type === OWNED_EVENT;
}
