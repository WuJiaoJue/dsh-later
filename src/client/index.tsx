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
 *
 * Context 服务类型增强在 `./runtime-augment.d.ts`：声明 `slots`/`sessions`/
 * `settingsScope`/`locale` 的最小契约，避免引入 `@deepseek-ai/dsh-client-*`
 * 这一族浏览器运行时包作为 NPM 依赖（它们是宿主注入产物，pnpm 解析预发布版
 * 会带来 hoisting/range 噪音）。
 * @module dsh-session-scheduler/client
 */
import type { Context } from '@deepseek-ai/cordis';
import { name } from '../domain.js';
import { injectStyles } from './styles.js';
import { SchedButton } from './components/SchedButton.js';
import { ScheduleDock } from './components/ScheduleDock.js';
import { SchedulerSettingsCard } from './components/SchedulerSettingsCard.js';
import { mountReminderToastHost } from './toast.jsx';
import type { SchedButtonInjected } from './components/SchedButton.js';
import type { ScheduleDockInjected } from './components/ScheduleDock.js';
import { mountSessionPresence, type PresenceLocaleLike, type PresenceSessionsLike } from './session-presence.js';

/** Filled slot：输入框右侧工具行。 */
const INPUT_RIGHT_SLOT = 'conversation.input.right';

/** 所需服务：插槽注册 + 会话解析（命令通道需要 session face）。 */
const inject = ['slots', 'sessions', 'conversation', 'settingsScope', 'locale'];

/** Locale 字典命名空间（locale 命名空间允许点分）。 */
const NS = 'settings.plugins.session-scheduler';

/** Settings 命名空间（必须与 host 端注册的字符串一致：dsh-session-scheduler）。 */
const SETTINGS_NS = 'dsh-session-scheduler';

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
  // 侧栏会话行「定时状态」badge（docs/ui/09 路线 B）：数据源为 sessions.list
  // 的行级 projectionValues（session.list 基线覆盖全会话，当前会话由投影帧
  // 实时推进），周期 refresh() 读 RPC 补时效。服务缺失时静默跳过。
  ctx.effect(
    () =>
      mountSessionPresence({
        sessions: sessions as unknown as PresenceSessionsLike,
        ...(locale === undefined ? {} : { locale: locale as unknown as PresenceLocaleLike }),
      }),
    'dsh-session-scheduler: presence',
  );

  // 注册 locale 字典
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, {
      zh: {
        title: '定时提醒',
        description: '配置会话内定时提醒的参数。',
        pendingBadge: '未保存',
        expand: '展开设置',
        collapse: '收起设置',
        readOnly: '本部署的设置为只读。',
        showButtonLabel: '显示定时按钮',
        showButtonHint: '关闭后输入框右侧不再显示时钟按钮；已创建的提醒仍会照常触发，并在输入框下方的待发送列表中显示。',
        optionOn: '显示',
        optionOff: '隐藏',
        maxSchedulesLabel: '单会话任务上限',
        maxSchedulesHint: '单个会话内允许创建的最大定时任务数量。',
        smartWindowHint: '用于「工作时间」芯片与智能模式自动排期。',
        workStartLabel: '工作时间开始',
        workEndLabel: '工作时间结束（晚间开始）',
        lunchStartLabel: '午休开始',
        lunchEndLabel: '午休结束',
        eveningEndLabel: '夜间静默起点',
        overriddenLabel: '已覆盖',
        resetLabel: '重置',
        invalidLabel: '请输入有效的数字。',
        invalidTimeLabel: '请使用 HH:mm 24 小时制时间。',
        save: '保存',
        saving: '保存中…',
        discard: '放弃修改',
        saveFailed: '保存失败，请重试。',
        loading: '加载中…',
        unavailable: '设置暂不可用。',
      },
      en: {
        title: 'Session Scheduler',
        description: 'Configure in-session scheduled reminders.',
        pendingBadge: 'Unsaved',
        expand: 'Show settings',
        collapse: 'Hide settings',
        readOnly: 'Settings for this deployment are read-only.',
        showButtonLabel: 'Show schedule button',
        showButtonHint: 'Hide the clock button on the input bar. Existing reminders keep firing and stay visible in the dock below the composer.',
        optionOn: 'Show',
        optionOff: 'Hide',
        maxSchedulesLabel: 'Max schedules per session',
        maxSchedulesHint: 'Maximum number of scheduled reminders allowed per session.',
        smartWindowHint: 'Used by the Work-hours chip and smart auto-scheduling.',
        workStartLabel: 'Work day start',
        workEndLabel: 'Work day end (evening start)',
        lunchStartLabel: 'Lunch break start',
        lunchEndLabel: 'Lunch break end',
        eveningEndLabel: 'Night quiet starts at',
        overriddenLabel: 'Overridden',
        resetLabel: 'Reset',
        invalidLabel: 'Please enter a valid number.',
        invalidTimeLabel: 'Use 24-hour HH:mm format.',
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

  // 绑定插件设置 namespace → wire scope，供按钮/面板订阅智能时段配置。
  // 设置页保存后 SchedPanel 芯片立即重算，无须刷新会话。
  const schedulerScope = settingsScope === undefined ? undefined : settingsScope.bind({ namespace: SETTINGS_NS });

  ctx.slots.inject(
    INPUT_RIGHT_SLOT,
    () =>
      ctx.slots.register(
        {
          name: INPUT_RIGHT_SLOT,
          id: 'session-scheduler',
          order: 50,
          inject: () => ({ callCommand, locale, schedulerScope } as SchedButtonInjected),
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
          inject: () => ({ callCommand, locale } as ScheduleDockInjected),
        },
        ScheduleDock,
      ),
  );

  // 注册设置页卡片：scope 以普通 prop 传入（与 dsh-wakatime / dsh-auto-collapse
  // 同款写法）——宿主渲染器会把 inject() 里的 `hooks.xxx` 转成 useXxx hook prop，
  // 而卡片组件按普通 `scope` prop 解构，放 hooks 里会导致 scope 为 undefined、
  // 卡片崩溃被卸载（设置 → 插件 里看不到本插件的卡片）。
  if (settingsScope !== undefined && locale !== undefined) {
    ctx.slots.inject('settings.plugin.item', function* () {
      yield ctx.slots.register({
        name: 'settings.plugin.item',
        key: SETTINGS_NS,
        locale: NS,
        inject: () => ({
          scope: settingsScope.bind({ namespace: SETTINGS_NS }),
          t: locale.bind(NS),
        }),
      }, SchedulerSettingsCard);
    });
  }
}

export { apply, inject, name };
