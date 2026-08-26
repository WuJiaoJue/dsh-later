/**
 * 用户提醒的独立调度器（per root agent）。
 *
 * 为什么需要它：dsh-schedule 的 runtime 只在三类时机重驱——agent 创建、**其
 * 自身工具**的持久化变更、agent 转 idle。用户经本插件命令/工具创建的提醒不会
 * 触发这三类，导致 timer 不武装、不到期触发（GUI 显示任务但永远不 fire）。
 *
 * 本调度器只处理**用户创建**的提醒，复用 dsh-schedule 导出的领域函数
 * （fold / resolveEveryOccurrence / render*Framing）和 `agent.followup`。
 * 防重复：两套调度器（本插件 + dsh-schedule）都通过**同一份持久化日志**做
 * 「fold → append dispatch」的原子判断（同一 JS 线程内同步完成），先到者写入
 * dispatch 事件后，后者 fold 即见已被派发 → 跳过，不会双触发。
 *
 * 触发点：用户 create/delete 成功后 requestDrive；agent 转 idle 时也
 * requestDrive（自愈）；agent 创建时启动。
 * @module dsh-session-scheduler/runtime
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { createUserMessage, boundContextSummary } from '@deepseek-ai/dsh-llm';
import {
  foldScheduleEvents,
  renderEveryReminderBatchFraming,
  renderReminderFraming,
  resolveEveryOccurrence,
} from '@deepseek-ai/dsh-schedule';
import type { ScheduleRecord, OneShotScheduleRecord, EveryScheduleRecord } from '@deepseek-ai/dsh-schedule';
import { OWNED_EVENT } from './domain.js';
import { foldOwnedIds, foldOwnedDelivery } from './user-tools.js';
import { detectTimeZone, formatHhmm } from './time-utils.js';

/** Node timers 能表示的最大延迟。 */
const MAX_TIMER_DELAY_MS = 2147483647;

/** 渲染未知错误（仅进程内诊断）。 */
function renderThrown(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/** 一次「用户提醒决策」：最优先到期一次性、或一批到期固定间隔，或下一次等待目标。 */
type UserDecision =
  | { kind: 'one-shot'; record: OneShotScheduleRecord }
  | {
      kind: 'every';
      acceptedAt: string;
      reminders: readonly { record: EveryScheduleRecord; occurrenceAt: string }[];
    }
  | { kind: 'wait'; target?: number };

export function dueUserDecision(
  active: readonly ScheduleRecord[],
  now: number,
): UserDecision {
  const indexed = active.map((record, index) => ({ record, index }));
  const byTargetThenCreate = (a: { record: ScheduleRecord; index: number }, b: { record: ScheduleRecord; index: number }) =>
    Date.parse(a.record.scheduledAt) - Date.parse(b.record.scheduledAt) || a.index - b.index;

  const oneShot = indexed
    .filter((entry) => entry.record.kind !== 'every' && Date.parse(entry.record.scheduledAt) <= now)
    .sort(byTargetThenCreate)[0]?.record as OneShotScheduleRecord | undefined;
  if (oneShot !== undefined) return { kind: 'one-shot', record: oneShot };

  const every = indexed
    .filter((entry) => entry.record.kind === 'every' && Date.parse(entry.record.scheduledAt) <= now)
    .sort(byTargetThenCreate);
  if (every.length > 0) {
    return {
      kind: 'every',
      acceptedAt: new Date(now).toISOString(),
      reminders: every.map(({ record }) => ({
        record: record as EveryScheduleRecord,
        occurrenceAt: resolveEveryOccurrence(record as EveryScheduleRecord, now).occurrenceAt,
      })),
    };
  }

  const target = active.reduce<number | undefined>((selected, record) => {
    const candidate = Date.parse(record.scheduledAt);
    return candidate > now && (selected === undefined || candidate < selected) ? candidate : selected;
  }, undefined);
  return { kind: 'wait', ...(target === undefined ? {} : { target }) };
}

/** 每个 agent 的独立调度器。 */
export class UserScheduleRuntime {
  private readonly ctx: Context;
  private readonly agent: Agent;
  private readonly stop: Promise<void>;
  private resolveStop: (() => void) | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private run: Promise<void> | undefined;
  private requested = false;
  private stopping = false;
  private disabled = false;
  private idleWait: Promise<void> | undefined;
  private disposal: Promise<void> | undefined;

  constructor(ctx: Context, agent: Agent) {
    this.ctx = ctx;
    this.agent = agent;
    this.stop = new Promise<void>((resolve) => {
      this.resolveStop = resolve;
    });
  }

  /** 是否仍为活动 root agent。 */
  private isLive(): boolean {
    try {
      return this.ctx.agents.get(this.agent.id) === this.agent && this.ctx.agents.roots().includes(this.agent);
    } catch {
      return false;
    }
  }

  /** 发起一次重算（合并多个触发为一次）。 */
  requestDrive(): void {
    if (this.stopping || this.disabled) return;
    this.clearTimer();
    this.requested = true;
    if (this.run !== undefined) return;
    const run = this.runRequested();
    this.run = run;
    run.then(
      () => {
        if (this.run === run) this.run = undefined;
      },
      () => {
        this.disabled = true;
        this.clearTimer();
        if (this.run === run) this.run = undefined;
      },
    );
  }

  /** 清空已武装的 timer。 */
  private clearTimer(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** 武装一次到下次目标的 timer。 */
  private arm(target: number, now: number): void {
    const delay = Math.min(target - now, MAX_TIMER_DELAY_MS);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.requestDrive();
    }, delay);
    // v8 ignore next -- 仅在测试环境需要
    if ((this.timer as unknown as { unref?: () => void }).unref) {
      (this.timer as unknown as { unref: () => void }).unref();
    }
  }

  /** 串行 drain 合并的触发。 */
  private async runRequested(): Promise<void> {
    while (this.requested && !this.stopping && !this.disabled) {
      this.requested = false;
      await this.driveOnce();
    }
  }

  /** 等待一次 public 的 idle 边界（供 agent 忙碌时重试）。 */
  private waitForIdle(): void {
    if (this.idleWait !== undefined) return;
    const wait = Promise.race([
      Promise.resolve().then(() => this.agent.whenIdle()),
      this.stop,
    ]);
    this.idleWait = wait;
    wait.then(
      () => {
        this.idleWait = undefined;
        if (!this.stopping) this.requestDrive();
      },
      () => {
        this.idleWait = undefined;
      },
    );
  }

  /** 停止调度器、取消 timer、等待在途派发收敛。 */
  dispose(): Promise<void> {
    this.disposal ??= (async () => {
      this.stopping = true;
      this.requested = false;
      this.clearTimer();
      this.resolveStop?.();
      const pending = [this.run, this.idleWait].filter((value) => value !== undefined);
      await Promise.allSettled(pending);
    })();
    return this.disposal;
  }

  /** 执行一次用户提醒决策与派发。 */
  private async driveOnce(): Promise<void> {
    this.clearTimer();
    if (!this.isLive()) return;
    // 持久化 barrier 预检（失败则本轮回合放弃）
    try {
      if ((await this.ctx.sessions.flush(this.agent.session)) !== true) return;
    } catch {
      return;
    }
    if (!this.isLive()) return;

    let active: readonly ScheduleRecord[];
    try {
      const folded = foldScheduleEvents(this.agent.session.events, this.agent.session.header.seedLength ?? 0);
      const owned = foldOwnedIds(this.agent.session.events);
      active = folded.active.filter((record) => owned.has(record.id));
    } catch (error) {
      this.ctx.logger.warn(
        `session-scheduler: fold 失败 agent "${this.agent.id}": ${renderThrown(error)}`,
      );
      return;
    }
    const now = Date.now();
    const decision = dueUserDecision(active, now);

    if (decision.kind === 'wait') {
      if (decision.target !== undefined) this.arm(decision.target, now);
      return;
    }

    // 派发：与 dsh-schedule 同构——先注入用户消息，再 append dispatch，再 flush。
    let maintenance;
    try {
      maintenance = this.agent.runMaintenance(() => {
        const claimedFolded = foldScheduleEvents(this.agent.session.events, this.agent.session.header.seedLength ?? 0);
        const owned = foldOwnedIds(this.agent.session.events);
        const delivery = foldOwnedDelivery(this.agent.session.events);
        const claimed = claimedFolded.active.filter((record) => owned.has(record.id));
        const decisionNow = Date.now();
        const decisionAtClaim = dueUserDecision(claimed, decisionNow);
        if (decisionAtClaim.kind === 'wait') {
          if (decisionAtClaim.target !== undefined) this.arm(decisionAtClaim.target, decisionNow);
          return Promise.resolve(false);
        }
        try {
          const message = this.buildMessage(decisionAtClaim, delivery);
          this.agent.followup(message);
        } catch (error) {
          this.ctx.logger.warn(
            `session-scheduler: framing/followup 失败 agent "${this.agent.id}": ${renderThrown(error)}`,
          );
          return Promise.resolve(false);
        }
        try {
          if (decisionAtClaim.kind === 'one-shot') {
            this.agent.session.append('schedule/change', {
              version: 1,
              operation: 'dispatch',
              id: decisionAtClaim.record.id,
            });
          } else {
            for (const reminder of decisionAtClaim.reminders) {
              this.agent.session.append('schedule/change', {
                version: 1,
                operation: 'dispatch',
                id: reminder.record.id,
                acceptedAt: decisionAtClaim.acceptedAt,
              });
            }
          }
        } catch (error) {
          this.ctx.logger.warn(
            `session-scheduler: dispatch append 失败 agent "${this.agent.id}": ${renderThrown(error)}`,
          );
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
    } catch (_busy) {
      this.waitForIdle();
      return;
    }
    if (!(await maintenance)) return;
    try {
      if ((await this.ctx.sessions.flush(this.agent.session)) !== true) return;
    } catch {
      return;
    }
    if (this.isLive()) this.requestDrive();
  }

  /**
   * 构造注入的消息，按 `delivery` 分流：
   *  - `user`（`/later` 显式请求的延迟发送）：原样内容 + `source.kind='user'`，
   *    让 GUI 呈现为「我」发出的普通气泡（产品取舍：用户明确要求以本人身份）。
   *    跳过 framing 防护 —— 这是「代发」语义，不是注入。
   *  - `context`（默认）：复用 dsh-schedule 的注入防护 framing + notice 表单，
   *    保持「上下文注入」的可信审计线。
   */
  private buildMessage(
    decision: Extract<UserDecision, { kind: 'one-shot' | 'every' }>,
    delivery: ReadonlyMap<string, 'context' | 'user'>,
  ) {
    const records =
      decision.kind === 'one-shot'
        ? [decision.record]
        : decision.reminders.map((reminder) => reminder.record);
    // 批次里任一条以“代发”为准（/later 必然同源，冲突时选更安全的 context）
    const asUser = records.some((record) => delivery.get(record.id) === 'user');
    if (asUser) {
      return createUserMessage({
        content: [{ type: 'text', text: records.map((record) => record.prompt).join('\n') }],
        source: { kind: 'user' },
      });
    }
    const text =
      decision.kind === 'one-shot'
        ? renderReminderFraming(decision.record)
        : renderEveryReminderBatchFraming(decision.reminders);
    return createUserMessage({
      content: [{ type: 'text', text }],
      source: {
        kind: 'plugin',
        plugin: '定时提醒',
        form: 'notice',
        summary: boundContextSummary(noticeSummary(records)),
      },
    });
  }
}

/** notice 摘要：每条 `HH:mm · 内容`，最多列 3 条，余者以计数收尾。 */
function noticeSummary(records: readonly ScheduleRecord[]): string {
  const tz = detectTimeZone();
  const lines = records.slice(0, 3).map((record) => `${formatHhmm(Date.parse(record.scheduledAt), tz)} · ${record.prompt}`);
  if (records.length > 3) lines.push(`等共 ${records.length} 条`);
  return lines.join('；');
}
