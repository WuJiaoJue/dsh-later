/**
 * dsh-session-scheduler 宿主入口。
 *
 * 挂载职责：
 *  1. 注册 `userSchedules` 会话投影（GUI 读取任务列表的权威状态）；
 *  2. 注册 slash 命令（客户端 → host 的创建/删除/列表变更通道）；
 *  3. 为每个 root agent 注册用户工具 `user_schedule_create/list/delete`
 *     （PRD「用户工具（底层暴露）」，模型亦可调用，与 dsh-schedule 双入口互补）。
 *
 * 依赖顺序：作为 peer 依赖的 dsh-schedule 需先加载（其 agent-runtime 负责
 * 到期 dispatch + followup 注入；本插件只负责「用户接口层」）。
 * @module dsh-session-scheduler
 */
import type { Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { GenericCallView, ToolCallKind } from '@deepseek-ai/dsh-tools/presentation';
import type {} from '@deepseek-ai/dsh-session-projection';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { userSchedulesProjectionUnit } from './projection.js';
import { registerUserScheduleCommands } from './commands.js';
import { UserScheduleRuntime } from './runtime.js';
import {
  DEFAULT_MAX_SCHEDULES,
  userScheduleCreate,
  userScheduleDelete,
  userScheduleList,
} from './user-tools.js';
import type { UserScheduleCreateInput, UserScheduleListResult, UserScheduleDeleteResult } from './user-tools.js';
import { name } from './domain.js';
import { registerOwnedSessionEventType } from './owned-event-registration.js';

/** 插件配置 schema（全可选，默认开箱即用；经 cordis config 覆盖）。 */
export const Config = s.object({
  /** 单 session 用户任务上限。 */
  maxSchedules: s.number().step(1).min(1).default(DEFAULT_MAX_SCHEDULES),
});

/** Settings namespace schema（设置 - 插件 配置 UI）。 */
const SchedulerSettingsSchema = s.object({
  /** 单 session 用户任务上限。 */
  maxSchedules: s.number().step(1).min(1).default(DEFAULT_MAX_SCHEDULES),
  /** 智能时段：工作时间开始（HH:mm）。 */
  workStart: s.string().default('09:00'),
  /** 智能时段：工作时间结束（HH:mm）。 */
  workEnd: s.string().default('18:00'),
  /** 智能时段：午休开始（HH:mm）。 */
  lunchStart: s.string().default('12:00'),
  /** 智能时段：午休结束（HH:mm）。 */
  lunchEnd: s.string().default('14:00'),
  /** 智能时段：晚间结束（HH:mm）。 */
  eveningEnd: s.string().default('22:00'),
});

/** 所需服务（延后激活，缺失时插件不加载）。 */
export const inject = ['agents', 'sessions', 'tools', 'commands', 'settings'];

/** 解析配置（容错非法值回落默认）。 */
function resolveMaxSchedules(value: number | undefined): number {
  if (typeof value !== 'number' || value < 1) return DEFAULT_MAX_SCHEDULES;
  return Math.floor(value);
}

/** 纯泛化等待卡片（GenericCallView）。 */
function present(title: string, kind: ToolCallKind, rawInput?: unknown): GenericCallView {
  return {
    card: 'generic',
    title,
    kind,
    ...(rawInput === undefined ? {} : { rawInput }),
  };
}

/** 渲染工具结果：JSON 文本。 */
function renderText(_args: unknown, value: string): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: value }];
}

/** 为单个 root agent 注册 `user_schedule_*` 工具。 */
function registerUserScheduleTools(
  rootCtx: Context,
  toolCtx: Context,
  agent: Agent,
  maxSchedules: number,
  onUserChange: (agent: Agent) => void,
): () => void {
  const dispose = () => undefined;
  try {
    const disposers = [
      toolCtx.tools.register(
        defineTool({
          name: 'user_schedule_create',
          description:
            '为用户创建一条当前会话内的定时提醒。必须提供非空提示、合法的 IANA 时区（必填）与恰好一个选择器：after_seconds（正整数延时秒）、at（显式偏移时间或 {date,time,time_zone} 本地时间）、every_seconds（≥300 的固定间隔秒）。创建来源被标记为用户工具，GUI 面板会展示。',
          parameters: {
            prompt: { type: 'string', required: true, description: '提醒内容（trim 后非空，≤1000 字符）。' },
            after_seconds: { type: 'number', description: '正整数延时秒数。' },
            every_seconds: { type: 'number', description: '固定间隔秒数，至少 300。' },
            at: {
              description: '绝对目标：显式偏移的 RFC 3339 字符串，或 {date, time, time_zone} 本地日历对象。',
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    date: { type: 'string', required: true },
                    time: { type: 'string', required: true },
                    time_zone: { type: 'string', required: true },
                  },
                },
              ],
            },
            time_zone: { type: 'string', required: true, description: 'IANA 时区（如 Asia/Shanghai）。' },
          },
          output: {
            schema: { type: 'string' },
            render: renderText,
          },
          async execute(args: UserScheduleCreateInput, exec) {
            if (exec.agent !== agent) return JSON.stringify({ ok: false, code: 'internal_error', message: '操作失败。' });
            const result = await userScheduleCreate(args, agent, rootCtx, maxSchedules);
            if (result.ok) {
              try {
                onUserChange(agent);
              } catch {
                /* 通知失败不影响结果 */
              }
            }
            return JSON.stringify(result);
          },
          presentCall: (args) => present('创建定时提醒', 'other', (args as { prompt?: unknown })?.prompt),
        }),
      ),
      toolCtx.tools.register(
        defineTool({
          name: 'user_schedule_list',
          description: '列出当前会话内用户创建的活动定时提醒（含 id、UTC 目标、scheduled/overdue 状态、投递模式）。',
          parameters: {},
          output: {
            schema: { type: 'string' },
            render: renderText,
          },
          async execute(_args, exec) {
            if (exec.agent !== agent) return JSON.stringify({ ok: false, code: 'internal_error', message: '操作失败。' });
            const result = await userScheduleList(agent, rootCtx);
            return JSON.stringify(result);
          },
          presentCall: () => present('列出定时提醒', 'read'),
        }),
      ),
      toolCtx.tools.register(
        defineTool({
          name: 'user_schedule_delete',
          description: '按 user_schedule_create / user_schedule_list 返回的精确 id 删除一条活动提醒；未知或已结束返回 deleted:false。',
          parameters: {
            id: { type: 'string', required: true, description: '精确会话内 schedule id。' },
          },
          output: {
            schema: { type: 'string' },
            render: renderText,
          },
          async execute(args: { id: string }, exec) {
            if (exec.agent !== agent) return JSON.stringify({ ok: false, code: 'internal_error', message: '操作失败。' });
            const result = await userScheduleDelete(args.id, agent, rootCtx);
            if (result.ok && result.deleted) {
              try {
                onUserChange(agent);
              } catch {
                /* 通知失败不影响结果 */
              }
            }
            return JSON.stringify(result);
          },
          presentCall: (args) => present('删除定时提醒', 'other', (args as { id?: unknown })?.id),
        }),
      ),
    ];
    return () => {
      for (const disposeOne of disposers.reverse()) disposeOne();
    };
  } catch (error) {
    dispose();
    rootCtx.logger.warn(`session-scheduler: user tools 注册失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Cordis 函数插件主体。
 * @param ctx - 全局服务上下文。
 * @param config - 可选配置（maxSchedules）。
 */
/** 插件卸载中的标记（避免继续接受新 agent 挂载）。 */
let stopping = false;

export function apply(ctx: Context, config?: { maxSchedules?: number }): void {
  const maxSchedules = resolveMaxSchedules(config?.maxSchedules);

  // 0. 注册自有事件类型（进程级、幂等）：否则含 `session-scheduler/user-schedule`
  //    的日志会被任何加载了本插件的读者以 SessionFormatUnsupportedError 拒读
  //    （GUI 表现为「历史加载失败」）。详见 domain.ts 中的说明。
  registerOwnedSessionEventType();

  // 1. `userSchedules` 会话投影（GUI 读状态）。
  // `as never`：本插件 dev 依赖解析到的 @deepseek-ai/dsh-session-projection
  // 可能是旧版（rc.1，契约 `schema`+顶层 `view`），而宿主运行时是 rc.2
  // （契约 `stateSchema`+`wire{viewSchema,view}`）。两者在类型层冲突，
  // 直接类型化注册会被旧版契约拒掉；运行时又必须按 rc.2 传。故此处保留
  // `as never` 显式声明「运行时契约以宿主为准」，并用
  // `tests/projection-unit.test.mjs` 在运行时锁定 rc.2 形状，防止回归。
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(userSchedulesProjectionUnit as never);
  });

  // 2. 注册 settings namespace（设置 - 插件 配置 UI）。
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace('dsh-session-scheduler'), SchedulerSettingsSchema);
  });

  // 每个 root agent 一个「用户提醒调度器」：负责确保命令/工具创建的提醒会武装 timer 并触发。
  const runtimes = new Map<Agent, UserScheduleRuntime>();

  /** 用户创建/删除成功 → 重驱该 agent 的用户调度器（也让 dsh-schedule 感知后续 idle）。 */
  const notifyUserChange = (agent: Agent): void => {
    try {
      runtimes.get(agent)?.requestDrive();
    } catch {
      /* 调度失败不影响工具/命令的结果 */
    }
  };

  // 2. slash 命令（客户端变更通道），全局注册一次。
  ctx.effect(() => registerUserScheduleCommands(ctx, maxSchedules, notifyUserChange), 'session-scheduler.commands()');

  // 3. 每个 root agent：注册用户工具 + 用户调度器生命周期。
  ctx.effect(() => {
    const stopCreated = ctx.on('agent/created', ({ agent }: { agent: Agent }) => {
      if (stopping || runtimes.has(agent) || !ctx.agents.roots().includes(agent)) return;
      const runtime = new UserScheduleRuntime(ctx, agent);
      let cleanup: () => void = () => undefined;
      try {
        cleanup = agent.ctx.effect(() => {
          const disposeTools = registerUserScheduleTools(ctx, agent.ctx, agent, maxSchedules, notifyUserChange);
          const stopStatus = agent.ctx.on('agent/status', ({ status }: { status: string }) => {
            // 自愈：agent 转 idle 时重算（与 dsh-schedule 同构），覆盖被遗漏的重驱。
            if (status === 'idle') runtime.requestDrive();
          });
          runtime.requestDrive();
          return async () => {
            stopStatus();
            disposeTools();
            try {
              await runtime.dispose();
            } finally {
              if (runtimes.get(agent) === runtime) runtimes.delete(agent);
            }
          };
        }, 'session-scheduler.userTools()');
        runtimes.set(agent, runtime);
      } catch (error) {
        ctx.logger.warn(
          `session-scheduler: agent "${agent.id}" 用户工具/调度器挂载失败: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
    return async () => {
      stopping = true;
      stopCreated();
      const runtimesToDispose = [...runtimes.values()];
      runtimes.clear();
      await Promise.allSettled(runtimesToDispose.map((runtime) => runtime.dispose()));
    };
  }, 'session-scheduler.userToolsLifecycle()');
}

export { name };
