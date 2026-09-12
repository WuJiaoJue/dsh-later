/**
 * 客户端微文案字典（双语：跟随宿主 DSH 的 locale 设置）。
 *
 * 语言解析：`useSchedT(locale)` 读取宿主 locale 服务的 active id（zh/en），
 * 从这里取对应字典；locale 服务缺失或 id 未收录时回退中文（v1 默认语言）。
 * @module dsh-later/client/strings
 */

export type SchedLocaleId = 'zh' | 'en';

const zh = {
  /** 输入框按钮 tooltip */
  buttonSchedule: '定时发送',
  /** 面板标题 */
  panelTitle: '定时提醒',
  /** 关闭面板 */
  close: '关闭',
  /** 快捷选项 */
  quick10m: '10分钟后',
  quick1h: '1小时后',
  quickSmart: '工作时间',
  quickCustom: '自定义…',
  /** 自定义输入 */
  dateLabel: '日期',
  timeLabel: '时间',
  today: '今天',
  tomorrow: '明天',
  /** 任务列表 */
  taskListTitle: '已设定',
  emptyTasks: '暂无定时任务',
  deleteTask: '删除提醒',
  /** 编辑提醒内容（dock 行内） */
  editTask: '编辑提醒',
  editSave: '保存',
  editCancel: '取消',
  editErrEmpty: '内容不能为空',
  editErrFailed: '修改失败：{message}',
  editErrNotAccepted: '命令未被受理',
  editErrCommandFailed: '命令失败',
  /** 主动插话发送：立即把提醒内容推给 agent（QueueDock「插话发送」语义） */
  steerTask: '插话发送',
  steerAlreadySent: '已插话',
  steerFailed: '插话失败：{message}',
  steerUnsupportedKind: '周期提醒暂不支持插话',
  /** dock 折叠头计数（QueueDock「N 条排队消息」样式） */
  panelCount: '{n} 条定时提醒',
  /** 精准倒计时（dock 行 + 折叠头） */
  countdownLeft: '剩',
  dueAnyMoment: '即将发送',
  /** 状态 */
  sending: '正在发送…',
  /** 确认按钮 */
  confirmAdd: '加入 · {time} 发送',
  confirmAddNoTime: '选择发送时间',
  /** 提示 */
  promptFromDraft: '将以输入框内容作为提醒内容',
  /** 错误提示 */
  errPromptEmpty: '请先在输入框输入内容',
  errPromptTooLong: '提醒内容不能超过 1000 字符',
  errTimePast: '请选择未来的时间',
  errCreateFailed: '创建失败：{message}',
  errDeleteFailed: '删除失败：{message}',
  /** 客户端本地错误（hook 抛令牌，UI 按当前语言翻译） */
  errNoSession: '当前无会话',
  errNotAcceptedStashed: '命令未被受理，已暂存本地',
  /** 侧栏会话行「定时状态」badge（docs/ui/09） */
  presenceBadgeAria: '有 {n} 条定时提醒，下次 {time}',
  presenceOverdueAria: '有 {n} 条定时提醒已到期，等待发送',
  presenceTooltip: '下次 {time} · {n} 条任务',
  presenceOverdueTooltip: '已到期 · {n} 条任务（等待会话空闲发送）',
  relMinutes: '{m} 分后',
  relHours: '{h} 小时后',
  relTomorrow: '明天 {time}',
  relDate: '{date} {time}',
  relClock: '{time}',
} as const;

/** 客户端本地错误令牌：hook 层抛出、组件层经字典翻译（避免 hook 依赖 locale）。 */
export const CLIENT_ERR = {
  NO_SESSION: 'SS_ERR_NO_SESSION',
  NOT_ACCEPTED: 'SS_ERR_NOT_ACCEPTED',
} as const;

const en: { [K in keyof typeof zh]: string } = {
  buttonSchedule: 'Schedule send',
  panelTitle: 'Scheduled reminders',
  close: 'Close',
  quick10m: 'In 10 minutes',
  quick1h: 'In 1 hour',
  quickSmart: 'Work hours',
  quickCustom: 'Custom…',
  dateLabel: 'Date',
  timeLabel: 'Time',
  today: 'Today',
  tomorrow: 'Tomorrow',
  taskListTitle: 'Scheduled',
  emptyTasks: 'No scheduled reminders',
  deleteTask: 'Delete reminder',
  editTask: 'Edit reminder',
  editSave: 'Save',
  editCancel: 'Cancel',
  editErrEmpty: 'Reminder content cannot be empty',
  editErrFailed: 'Edit failed: {message}',
  editErrNotAccepted: 'Command was not accepted',
  editErrCommandFailed: 'Command failed',
  steerTask: 'Send now',
  steerAlreadySent: 'Steered',
  steerFailed: 'Steer failed: {message}',
  steerUnsupportedKind: 'Recurring reminders can\'t be steered',
  panelCount: '{n} scheduled reminders',
  countdownLeft: 'in',
  dueAnyMoment: 'Sending soon',
  sending: 'Sending…',
  confirmAdd: 'Add · send at {time}',
  confirmAddNoTime: 'Pick a send time',
  promptFromDraft: 'The composer draft will be used as the reminder content',
  errPromptEmpty: 'Type something in the composer first',
  errPromptTooLong: 'Reminder content cannot exceed 1000 characters',
  errTimePast: 'Pick a future time',
  errCreateFailed: 'Create failed: {message}',
  errDeleteFailed: 'Delete failed: {message}',
  errNoSession: 'No active session',
  errNotAcceptedStashed: 'Command was not accepted; saved locally',
  presenceBadgeAria: '{n} scheduled reminder(s), next at {time}',
  presenceOverdueAria: '{n} scheduled reminder(s) due, waiting to send',
  presenceTooltip: 'Next at {time} · {n} task(s)',
  presenceOverdueTooltip: 'Due · {n} task(s) (sends when the session is idle)',
  relMinutes: 'in {m} min',
  relHours: 'in {h} h',
  relTomorrow: 'Tomorrow {time}',
  relDate: '{date} {time}',
  relClock: '{time}',
};

/** 单语言文案字典类型（宽化为 string，zh/en 通用）。 */
export type SchedStrings = { [K in keyof typeof zh]: string };

/** 全部 locale 字典（键集一致，由 en 的映射类型保证）。 */
export const schedDicts: Record<SchedLocaleId, SchedStrings> = { zh, en };

/** 按 locale id 取字典；未收录 id 回退中文。 */
export function dictFor(localeId: string | undefined): SchedStrings {
  return localeId === 'en' ? schedDicts.en : schedDicts.zh;
}

/** 把 {time} / {message} 类占位符替换为参数。 */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}
