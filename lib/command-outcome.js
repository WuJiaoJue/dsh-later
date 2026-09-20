/**
 * slash 命令的执行结果：**只表达「是否被受理」**。
 *
 * 为什么单独成模块并写清楚：`dsh-commands` 的 admission 语义只回
 * `RemoteResult<{matched}>`，handler 的业务结果不从这里返回（它落在会话记录 /
 * 投影里）。因此客户端**不得**用本类型判断「业务是否真的发生了」——例如删除
 * 暂停项时 host 可能返回 `deleted:false`，而这里照样是 `matched: true`。
 * 需要业务事实时以 `userSchedules` 投影为准（见 ScheduleDock 的观察窗对账）。
 *
 * 本模块被 host 与 client 两侧共用（与 smart-window / time-utils 同款：
 * 同时列出在 tsconfig.json 与 tsconfig.client.json 的 include 中）。
 *
 * @module dsh-later/command-outcome
 */
export {};
