/**
 * 客户端微文案字典（v1 中文优先）。
 * @module dsh-session-scheduler/client/strings
 */

export const strings = {
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
  deleteTask: '删除',
  /** 编辑提醒内容（dock 行内） */
  editTask: '修改内容',
  editSave: '保存',
  editCancel: '取消',
  editErrEmpty: '内容不能为空',
  editErrFailed: '修改失败：{message}',
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
  errTimePast: '请选择未来的时间',
  errCreateFailed: '创建失败：{message}',
  errDeleteFailed: '删除失败：{message}',
} as const;

export type Strings = typeof strings;

/** 把 {time} / {message} 类占位符替换为参数。 */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}
