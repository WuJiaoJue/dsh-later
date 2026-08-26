/**
 * dsh-session-scheduler client 端：会话输入框右侧的「定时提醒」按钮 + 面板。
 *
 * 数据流：
 *  - 读状态：`useProjection('userSchedules')`（宿主会话投影实时推送）。
 *  - 写状态：`session.command('/user-schedule-create ...')` 等 slash 命令
 *    直达宿主（命令 handler 与工具共享同一套 user-tools 领域逻辑）。
 *
 * 零核心改动，纯插件挂载：注册 `conversation.input.right` 插槽条目
 * （order 50，紧跟附件/语音之后、发送按钮之前）。
 *
 * rc.7 兼容性：所需服务通过模块级 `inject` 数组声明（fiber 激活门控），
 * apply 内用 `ctx.get(name)` 读取；缺失时静默跳过（不阻塞会话其他能力）。
 * @module dsh-session-scheduler/client
 */
import type {} from '@deepseek-ai/dsh-client-runtime/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { Context } from '@deepseek-ai/cordis';
import { name } from '../domain.js';
import { injectStyles } from './styles.js';
import { SchedButton } from './components/SchedButton.js';
import { ScheduleDock } from './components/ScheduleDock.js';
import { SchedulerSettingsCard } from './components/SchedulerSettingsCard.js';
import { mountReminderToastHost } from './toast.jsx';
import type { SchedButtonInjected } from './components/SchedButton.js';
import type { ScheduleDockInjected } from './components/ScheduleDock.js';

/** Filled slot：输入框右侧工具行。 */
const INPUT_RIGHT_SLOT = 'conversation.input.right';

/** 所需服务：插槽注册 + 会话解析（命令通道需要 session face）。 */
const inject = ['slots', 'sessions', 'conversation', 'settingsScope', 'locale'];

const NS = 'settings.plugins.session-scheduler';

/**
 * 浏览器插件主体。
 * @param ctx - client 根上下文。
 */
/**
 * 浏览器插件主体。
 * @param ctx - client 根上下文。
 */
function apply(ctx: Context): void {
  const slots = ctx.get('slots');
  const sessions = ctx.get('sessions');
  const settingsScope = ctx.get('settingsScope');
  const locale = ctx.get('locale');
  if (slots === undefined || sessions === undefined) return;

  // 样式注入（卸载清理）。
  ctx.effect(() => injectStyles(), 'dsh-session-scheduler: styles');
  // 提醒到达 toast 宿主（幂等；随插件生命周期卸载）。
  ctx.effect(() => mountReminderToastHost(), 'dsh-session-scheduler: toast host');

  // 注册 locale 字典
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, {
      zh: {
        title: '定时提醒',
        description: '配置会话内定时提醒的参数。',
        maxSchedulesLabel: '单会话任务上限',
        maxSchedulesHint: '单个会话内允许创建的最大定时任务数量。',
        overriddenLabel: '已覆盖',
        resetLabel: '重置',
        invalidLabel: '请输入有效的数字。',
        save: '保存',
        saving: '保存中…',
        discard: '放弃',
        saveFailed: '保存失败，请重试。',
        loading: '加载中…',
        unavailable: '设置暂不可用。',
      },
      en: {
        title: 'Session Scheduler',
        description: 'Configure in-session scheduled reminders.',
        maxSchedulesLabel: 'Max schedules per session',
        maxSchedulesHint: 'Maximum number of scheduled reminders allowed per session.',
        overriddenLabel: 'Overridden',
        resetLabel: 'Reset',
        invalidLabel: 'Please enter a valid number.',
        save: 'Save',
        saving: 'Saving…',
        discard: 'Discard',
        saveFailed: 'Save failed, please try again.',
        loading: 'Loading…',
        unavailable: 'Settings unavailable.',
      },
    }), 'dsh-session-scheduler: locale');
  }

  /** 执行一条 slash 命令（解析会话 face → command()）。 */
  const callCommand: SchedButtonInjected['callCommand'] = async (sessionId, line) => {
    const actx = sessions.scope(sessionId as never);
    const face = actx === undefined ? undefined : sessions.sessionOf(actx);
    if (face === undefined) return false;
    try {
      const result = await face.command(line);
      return result?.ok === true && result.value?.matched === true;
    } catch {
      return false;
    }
  };

  ctx.slots.inject(
    INPUT_RIGHT_SLOT,
    () =>
      ctx.slots.register(
        {
          name: INPUT_RIGHT_SLOT,
          id: 'session-scheduler',
          order: 50,
          inject: () => ({ callCommand } as SchedButtonInjected),
        },
        SchedButton,
      ),
  );

  // 待发送提醒 dock（对齐 QueueDock 呈现；排在排队消息之后）。
  ctx.slots.inject(
    'conversation.input.dock',
    () =>
      ctx.slots.register(
        {
          name: 'conversation.input.dock',
          id: 'session-scheduler-dock',
          order: 30,
          inject: () => ({ callCommand } as ScheduleDockInjected),
        },
        ScheduleDock,
      ),
  );

  // 注册设置页卡片
  if (settingsScope !== undefined && locale !== undefined) {
    ctx.slots.inject('settings.plugin.item', function* () {
      yield ctx.slots.register({
        name: 'settings.plugin.item',
        key: 'dsh-session-scheduler',
        locale: NS,
        inject: () => ({
          hooks: {
            settingsScope: settingsScope.bind({ namespace: 'dsh-session-scheduler' }),
          },
          t: locale.bind(NS),
        }),
      }, SchedulerSettingsCard);
    });
  }
}

export { apply, inject, name };
