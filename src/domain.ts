/**
 * dsh-session-scheduler 领域类型与事件荷载。
 *
 * 兼容性说明（关键设计决策）：
 * dsh-schedule 对 `schedule/change` 荷载采用严格解码（`hasExactKeys` 拒绝任何
 * 多余字段）。因此本插件**不会**在 `schedule/change` 里追加 `source` 字段——
 * 那会让 dsh-schedule 自身 fold 抛 `corrupt_schedule_log`，破坏 AC-20 互不干扰。
 * 用户来源**不再**用伴生会话事件记录（2026-09 根治）：曾用自有事件
 * `session-scheduler/user-schedule` 写进会话日志，但该类型不在宿主词汇表内，
 * 持久化层在特定时序下会静默丢行、留下永久 seq 缺口，导致整份历史被拒读。
 * 现改为 sidecar 文件（见 ownership-store.ts）；该事件类型仅作**读兼容**
 * 保留（旧日志可能仍含此事件，注册 + fold 逻辑不再写入）。
 *
 * @module dsh-session-scheduler/domain
 */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-session-projection/types';

/** 插件名（与 cordis 条目 id / manifest 一致）。 */
export const name = 'dsh-session-scheduler';

/** 会话投影键：GUI 通过 `useProjection` / `faceOf` 读取用户任务列表。 */
export const PROJECTION_KEY = 'userSchedules';

/** 伴生所有权事件类型（**历史遗留，仅读兼容**；新写入一律走 ownership-store）。 */
export const OWNED_EVENT = 'session-scheduler/user-schedule';

/**
 * 伴生所有权事件荷载。语义：`add` 声明一个由用户工具创建的 schedule id；
 * `remove` 撤销该声明。它与 `schedule/change` 的 create/delete 成对出现，
 * 但由本插件独立解码——dsh-schedule 永远不会看到它。
 *
 * `delivery`（可选，默认 `context`）标记到点注入的形态：
 *  - `context`：框架认可的安全形式（source.kind='plugin'，带 notice 表单 + 防护
 *    framing，保持「上下文注入」的可信审计线）；
 *  - `user`：延迟发送的「代发」形式（source.kind='user'），由 `/later` 命令显式
 *    请求，需用户明确表达『到点以我身份发出』，产品取舍见 commands.ts。
 */
export interface UserScheduleOwnedChange {
  readonly version: 1;
  readonly operation: 'add' | 'remove';
  readonly id: string;
  readonly delivery?: 'context' | 'user';
}

/** 到点注入形态（见 {@link UserScheduleOwnedChange}）。 */
export type UserScheduleDelivery = 'context' | 'user';

/**
 * 投影输出的一条用户任务骨架（不含随墙钟变化的状态字段；
 * `scheduled`/`overdue` 由客户端用 `scheduledAt` 实时推导）。
 * 字段用 snake_case，与 `user_schedule_list` 工具响应保持一致。
 */
export interface UserScheduleWireItem {
  readonly id: string;
  readonly kind: 'after' | 'at' | 'every';
  readonly prompt: string;
  readonly after_seconds?: number;
  readonly every_seconds?: number;
  readonly scheduled_at: string;
  /** 创建时刻（来自 create 事件的 time；旧日志/未知时缺省）。 */
  readonly created_at?: string;
  readonly delivery_mode: 'session-local';
}

/** 投影输出值。 */
export interface UserScheduleProjectionValue {
  readonly schedules: readonly UserScheduleWireItem[];
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** 本插件自有的用户所有权记录（dsh-schedule 忽略）。 */
    'session-scheduler/user-schedule': UserScheduleOwnedChange;
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** 用户创建的、当前活动的定时提醒列表。 */
    userSchedules: UserScheduleProjectionValue;
  }

  interface SessionProjectionStateMap {
    /**
     * 投影内部折叠状态（plain JSON：owned/active 用数组承载，
     * 满足持久化投影缓存的 plain-JSON 前提）。
     */
    userSchedules: UserScheduleProjectionState;
  }
}

/**
 * 投影内部折叠状态（plain JSON）。与 `src/projection.ts` 中的同名接口
 * 结构一致；在 domain.ts 里用结构化类型承载是因为合并的
 * `SessionProjectionStateMap` 需要在这里给出 —— 而 projection.ts 依赖
 * domain.ts，反向 import 会形成环。
 */
export interface UserScheduleProjectionState {
  /** 会话 id（init 时由 header 注入；apply 据此查询所有权 sidecar 缓存）。 */
  readonly sessionId: string;
  readonly owned: readonly string[];
  readonly active: readonly {
    id: string;
    kind: 'after' | 'at' | 'every';
    prompt: string;
    afterSeconds?: number;
    everySeconds?: number;
    scheduledAt: string;
    createdAt?: number;
  }[];
  readonly seedSeq: number;
}

/** 判断事件是否属于本插件所有权流。 */
export function isOwnedEvent(event: SessionEvent): event is SessionEvent & {
  data: UserScheduleOwnedChange;
} {
  return event.type === OWNED_EVENT;
}
