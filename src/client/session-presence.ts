/**
 * 侧栏会话行「定时状态」badge（设计稿 docs/ui/09 路线 B：DOM 注入）。
 *
 * 数据源（零宿主改动）：`sessions.list` 快照里每行 summary 携带
 * `projectionValues.userSchedules` —— `session.list` 基线为全会话携带
 * projections 块（live 走注册表现值、冷会话走持久化投影缓存），当前打开的
 * 会话由 `session/projection` mux 帧实时推进并合入同一快照。因此：
 *  - 订阅 `sessions.list` 即可感知所有会话的任务变化；
 *  - 周期性 `sessions.refresh()`（session.list 读 RPC，不写会话日志）补齐
 *    未打开会话的时效；
 *  - 30s 本地 tick 只重算 badge 状态（scheduled/urgent/overdue），零网络。
 *
 * 行→会话映射：行元素向上走 ≤8 层 React fiber，取 `memoizedProps.node.id`
 * （ui-workspace 会话行的行数据，实测深度 3）。**禁止**依赖 `YDXeBa_*` 等
 * 构建期 hash 类名；探测失败时安静跳过（badge 缺失，绝不误标）。
 *
 * 插入策略：行首子元素是状态 slot —— slot 内已有 svg（进行中 orb）时 badge
 * 插在 slot 之后（`.ss-presence-beside`），否则塞进 slot 内（与 orb 同位）。
 * badge 元素带 `.ss-presence` 类，全部状态用 data-state 表达；React 重渲染
 * 移除注入节点时由 MutationObserver 重插。
 *
 * ## 悬浮卡片状态区增补（issue #4）
 *
 * 行内 badge 与宿主悬浮卡片数据源不一致：卡片正文由宿主 `sessionStatuses`
 * 的**闭合硬编码状态链**生成（只读 subagents / pendingInteraction / running
 * / completed），`userSchedules` 不在其中，且宿主**没有对外暴露任何 hover
 * 卡片插槽**（ui-conversation / ui-sidebar / ui-workspace 的 SlotMap 里均无
 * hover 相关槽位）。因此卡片侧不存在注册式扩展点，只能在 DOM 层增补。
 *
 * 可行性的关键事实（实测）：卡片是挂在 `document.body` 下的 portal，**不与
 * 宿主行共享 DOM 祖先**，无法靠行元素找过去；但卡片的 React fiber 在浅层
 * （实测深度 4）携带 `memoizedProps.node.id`，与行元素用的是**同一套反查
 * 技术**，因此仍能把卡片关联回 sessionId。
 *
 * 增补方式是**纯追加**：仅在卡片状态区末尾追加一行与宿主 `.hoverStatus`
 * 同构的节点，不改写、不替换、不重排宿主已有状态行，故 pendingInteraction /
 * running 等既有状态的优先级天然不变；无活动定时任务的会话不做任何改动。
 * 卡片每次悬浮由 React 重建子树（注入节点会被清掉），重插同样交给既有的
 * MutationObserver 重扫循环。
 * @module dsh-later/client/session-presence
 */
import {
  badgeStateFor,
  hoverScheduleStatus,
  relativeFireLabel,
  summarizeSchedules,
  type PresenceBadgeState,
  type RelativeFireLabels,
} from '../presence.js';
import { dictFor, format, type SchedStrings } from './strings.js';

/** 会话行 summary 的结构化子集（避免引入运行时包类型依赖）。 */
interface PresenceSessionSummaryLike {
  readonly displayTitle?: string;
  readonly title?: string;
  readonly projectionValues?: Readonly<Record<string, unknown>>;
}

/** 会话列表快照的结构化子集。 */
interface PresenceListStateLike {
  readonly byId: Readonly<Record<string, PresenceSessionSummaryLike>>;
}

/** 客户端 sessions 服务的结构化子集（SessionRuntime 的 list + refresh）。 */
export interface PresenceSessionsLike {
  readonly list: {
    getSnapshot(): PresenceListStateLike;
    subscribe(fn: () => void): () => void;
  };
  refresh(): Promise<unknown>;
}

/** 宿主 locale 服务的结构化子集。 */
export interface PresenceLocaleLike {
  getSnapshot(): { active: string };
  subscribe(fn: () => void): () => void;
}

export interface SessionPresenceOptions {
  readonly sessions: PresenceSessionsLike;
  readonly locale?: PresenceLocaleLike;
}

/** badge 类名（本插件命名空间，绝不复用宿主类名）。 */
const BADGE_CLASS = 'ss-presence';
/** 悬浮卡片增补行类名（本插件命名空间）。 */
const HOVER_ROW_CLASS = 'ss-hover-status';
/** fiber 探测的最大上溯层数（实测深度 3；留余量到 8）。 */
const FIBER_MAX_DEPTH = 8;
/** 扫描去抖（流式输出期间 mutation 密集，合并到每帧级别足够）。 */
const SCAN_DEBOUNCE_MS = 60;
/** badge 状态重算周期（本地时钟，零网络）。 */
const STATE_TICK_MS = 30_000;
/** session.list 重拉周期（读 RPC；仅页面可见时执行）。 */
const REFRESH_INTERVAL_MS = 60_000;

/** 时钟 glyph（10×10 crispEdges，外圈 8 方块 + 上/右指针，中心留空）。 */
const CLOCK_SVG =
  '<svg width="10" height="10" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">' +
  '<g class="ss-presence-ring">' +
  '<rect x="0" y="0" width="2" height="2"/><rect x="4" y="0" width="2" height="2"/>' +
  '<rect x="8" y="0" width="2" height="2"/><rect x="8" y="4" width="2" height="2"/>' +
  '<rect x="8" y="8" width="2" height="2"/><rect x="4" y="8" width="2" height="2"/>' +
  '<rect x="0" y="8" width="2" height="2"/><rect x="0" y="4" width="2" height="2"/>' +
  '</g>' +
  '<g class="ss-presence-hand">' +
  '<rect x="4" y="2" width="2" height="2"/><rect x="6" y="4" width="2" height="2"/>' +
  '</g></svg>';

const hhmmFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const formatHhmm = (epoch: number): string => hhmmFormatter.format(epoch);
const formatDate = (epoch: number): string => dateFormatter.format(epoch);

/** React fiber 节点的结构化子集（内部字段，仅读）。 */
interface FiberNodeLike {
  readonly return?: FiberNodeLike;
  readonly memoizedProps?: { readonly node?: { readonly id?: unknown } };
}

/** 会话行 → sessionId：向上 ≤8 层 fiber，取 `memoizedProps.node.id`（session- 前缀）。 */
function sessionIdOfRow(row: Element): string | undefined {
  return sessionIdOfNode(row);
}

/**
 * 悬浮卡片 → sessionId。
 *
 * 卡片是 `document.body` 下的 portal，与宿主会话行没有 DOM 祖先关系，只能靠
 * fiber 反查；实测从卡片根上溯第 4 层即 `SessionNode`（携带 node.id），与行
 * 元素同源。探测失败返回 undefined（安静跳过，绝不误标）。
 */
function sessionIdOfHoverCard(card: Element): string | undefined {
  return sessionIdOfNode(card);
}

/** 共享的 fiber 反查：向上 ≤8 层取 `memoizedProps.node.id`（session- 前缀）。 */
function sessionIdOfNode(element: Element): string | undefined {
  const host = element as unknown as Record<string, unknown>;
  const fiberKey = Object.keys(host).find((key) => key.startsWith('__reactFiber$'));
  if (fiberKey === undefined) return undefined;
  let fiber = host[fiberKey] as FiberNodeLike | undefined;
  for (let depth = 0; fiber !== undefined && depth < FIBER_MAX_DEPTH; depth += 1, fiber = fiber.return) {
    const node = fiber.memoizedProps?.node;
    const id = node?.id;
    if (typeof id === 'string' && id.startsWith('session-')) return id;
  }
  return undefined;
}

/** 从列表快照归纳 badge 索引：sessionId → {count, nextAt}（仅保留 count>0 的行）。 */
function buildIndex(state: PresenceListStateLike): Map<string, { count: number; nextAt?: number }> {
  const index = new Map<string, { count: number; nextAt?: number }>();
  for (const [sessionId, summary] of Object.entries(state.byId)) {
    const schedules = (summary.projectionValues?.['userSchedules'] as
      | { schedules?: readonly { scheduled_at?: string }[] }
      | undefined)?.schedules;
    const entry = summarizeSchedules(schedules);
    if (entry.count > 0) index.set(sessionId, entry);
  }
  return index;
}

/** 找行内已注入的 badge（slot 内或 slot 后；不越界到嵌套子行）。 */
function findBadge(row: HTMLElement): HTMLElement | null {
  for (const child of Array.from(row.children)) {
    if (child.classList.contains(BADGE_CLASS)) return child as HTMLElement;
    const inside = child.querySelector(`:scope > .${BADGE_CLASS}`);
    if (inside !== null) return inside as HTMLElement;
  }
  return null;
}

/** 相对时间文案槽位（按语言组装）。 */
function labelsFor(dict: SchedStrings): RelativeFireLabels {
  return {
    imminent: dict.dueAnyMoment,
    minutes: (m) => format(dict.relMinutes, { m }),
    hours: (h) => format(dict.relHours, { h }),
    tomorrow: (time) => format(dict.relTomorrow, { time }),
    clock: (time) => format(dict.relClock, { time }),
    date: (date, time) => format(dict.relDate, { date, time }),
  };
}

/**
 * 挂载侧栏 badge 层。返回卸载函数（断开 observer、清理定时器/订阅，并移除
 * 已注入的 badge 节点）。
 */
export function mountSessionPresence(options: SessionPresenceOptions): () => void {
  const { sessions, locale } = options;
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => undefined;
  }

  let index = new Map<string, { count: number; nextAt?: number }>();
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const dictForNow = (): SchedStrings => dictFor(locale?.getSnapshot().active);

  /** 全量重扫：重建索引 + 按当前 DOM 对账 badge。 */
  const scan = (): void => {
    if (disposed) return;
    index = buildIndex(sessions.list.getSnapshot());
    const dict = dictForNow();
    const now = Date.now();
    for (const row of Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"][draggable="true"]'))) {
      // 工作区行带 aria-expanded；会话行没有。探测失败安静跳过。
      if (row.hasAttribute('aria-expanded')) continue;
      applyBadge(row, now, dict);
    }
    // 悬浮卡片只有在弹出时才存在于 DOM；未弹出时是零开销的空查询。
    applyHoverCard(now, dict);
  };

  const scheduleScan = (): void => {
    if (disposed || scanTimer !== undefined) return;
    scanTimer = setTimeout(() => {
      scanTimer = undefined;
      scan();
    }, SCAN_DEBOUNCE_MS);
  };

  /** 对单行插入/更新/移除 badge。 */
  function applyBadge(row: HTMLElement, now: number, dict: SchedStrings): void {
    const sessionId = sessionIdOfRow(row);
    if (sessionId === undefined) return;
    const entry = index.get(sessionId);
    const existing = findBadge(row);
    if (entry === undefined) {
      existing?.remove();
      return;
    }
    const state: PresenceBadgeState = badgeStateFor(entry.nextAt, now);
    const time =
      entry.nextAt === undefined ? '' : relativeFireLabel(entry.nextAt, now, labelsFor(dict), formatHhmm, formatDate);
    const aria =
      state === 'overdue'
        ? format(dict.presenceOverdueAria, { n: entry.count })
        : format(dict.presenceBadgeAria, { n: entry.count, time });
    const tooltip =
      state === 'overdue'
        ? format(dict.presenceOverdueTooltip, { n: entry.count })
        : format(dict.presenceTooltip, { n: entry.count, time });
    if (existing !== null) {
      if (existing.dataset.state !== state) existing.dataset.state = state;
      if (existing.getAttribute('aria-label') !== aria) existing.setAttribute('aria-label', aria);
      if (existing.getAttribute('title') !== tooltip) existing.setAttribute('title', tooltip);
      return;
    }
    const slot = row.firstElementChild;
    if (slot === null) return;
    const beside = slot.querySelector('svg') !== null;
    const badge = document.createElement('span');
    badge.className = beside ? `${BADGE_CLASS} ${BADGE_CLASS}-beside` : BADGE_CLASS;
    badge.dataset.state = state;
    badge.setAttribute('role', 'img');
    badge.setAttribute('aria-label', aria);
    badge.setAttribute('title', tooltip);
    badge.innerHTML = CLOCK_SVG;
    if (beside) slot.after(badge);
    else slot.append(badge);
  }

  /**
   * 找当前弹出的悬浮卡片：返回卡片 portal 根、正文根（状态行的父容器）与
   * 关联到的 sessionId。
   *
   * 卡片是 `body` 的直系 portal（实测 DOM：`body > div._card_* > div.hoverContent`），
   * 与会话行没有 DOM 祖先关系，故只能按结构探测 + fiber 反查关联：
   * 遍历 body 直系浮层，取「首个子元素内含状态点行、且自身 fiber 能反查到
   * sessionId」的那个作为卡片。
   *
   * ⚠️ 刻意不依赖 `YDXeBa_*` / `_card_*` 等构建期 hash 类名；探测不到就返回
   * null（安静跳过，绝不误标）。
   */
  function findHoverCard(): { card: HTMLElement; statusHost: HTMLElement; sessionId: string } | null {
    for (const card of Array.from(document.body.children)) {
      if (!(card instanceof HTMLElement)) continue;
      const statusHost = card.firstElementChild;
      if (!(statusHost instanceof HTMLElement)) continue;
      // 状态行：直接子块里含 aria-hidden 的前导 span（状态点）+ 文案 span。
      const hasStatusRow = Array.from(statusHost.children).some((child) => {
        const dot = child.firstElementChild;
        return (
          child.children.length >= 2 &&
          dot !== null &&
          dot.tagName === 'SPAN' &&
          dot.getAttribute('aria-hidden') === 'true'
        );
      });
      if (!hasStatusRow) continue;
      const sessionId = sessionIdOfHoverCard(card);
      if (sessionId === undefined) continue;
      return { card, statusHost, sessionId };
    }
    return null;
  }

  /**
   * 对悬浮卡片追加一行定时状态（仅当该会话有活动任务时）。
   *
   * 纯追加：宿主既有状态行原样保留，故 pendingInteraction / running 的优先级
   * 不受影响；已有本插件行时只更新文案（React 重建后由重扫重插）。
   */
  function applyHoverCard(now: number, dict: SchedStrings): void {
    const found = findHoverCard();
    if (found === null) return;
    const { statusHost, sessionId } = found;
    const existing = statusHost.querySelector<HTMLElement>(`:scope > .${HOVER_ROW_CLASS}`);
    const entry = index.get(sessionId);
    if (entry === undefined) {
      // 该会话无活动任务：移除可能残留的行（含从有任务行切到无任务行）。
      existing?.remove();
      return;
    }
    const { label } = hoverScheduleStatus(entry, now, labelsFor(dict), dict, formatHhmm, formatDate);
    const state = badgeStateFor(entry.nextAt, now);
    if (existing !== null) {
      const text = existing.lastElementChild;
      if (text !== null && text.textContent !== label) text.textContent = label;
      if (existing.dataset.state !== state) existing.dataset.state = state;
      return;
    }
    // 与宿主 .hoverStatus 行同构：状态点（aria-hidden）+ 文案 span。
    const row = document.createElement('div');
    row.className = HOVER_ROW_CLASS;
    row.dataset.state = state;
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    dot.className = 'ss-hover-status-dot';
    const text = document.createElement('span');
    text.textContent = label;
    row.append(dot, text);
    statusHost.append(row);
  }

  // 数据/环境触发：列表变化（含当前会话投影帧）、语言切换、DOM 变化。
  const unsubscribeList = sessions.list.subscribe(scheduleScan);
  const unsubscribeLocale = locale?.subscribe(scheduleScan);
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  // 其余会话的时效：session.list 读 RPC（不写会话日志），仅页面可见时。
  const refreshNow = (): void => {
    if (disposed) return;
    try {
      void sessions.refresh().catch(() => undefined);
    } catch {
      /* 刷新失败不影响既有 badge */
    }
  };
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      refreshNow();
      scheduleScan();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
  const stateTick = setInterval(scheduleScan, STATE_TICK_MS);
  const refreshTick = setInterval(() => {
    if (document.visibilityState === 'visible') refreshNow();
  }, REFRESH_INTERVAL_MS);

  refreshNow();
  scheduleScan();

  return () => {
    disposed = true;
    if (scanTimer !== undefined) clearTimeout(scanTimer);
    clearInterval(stateTick);
    clearInterval(refreshTick);
    observer.disconnect();
    unsubscribeList();
    unsubscribeLocale?.();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onVisible);
    for (const badge of Array.from(document.querySelectorAll(`.${BADGE_CLASS}`))) badge.remove();
    for (const row of Array.from(document.querySelectorAll(`.${HOVER_ROW_CLASS}`))) row.remove();
  };
}
