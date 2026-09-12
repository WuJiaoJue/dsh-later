/**
 * 把 `OWNED_EVENT` 注册进宿主的已知会话事件类型集合（进程级、幂等）。
 *
 * 2026-09 起插件**不再写入**该事件（所有权改存 sidecar，见 ownership-store.ts），
 * 本注册保留为**读兼容**：早期版本写入的历史日志（含当前 format 的日志）仍含
 * 此事件类型，未注册时宿主读路径会以「unknown event type not marked ignorable」
 * 拒读整份日志。
 *
 * 历史教训（为什么当初需要它 + 为什么现在不再写入）：当前构建的
 * `Session.append(type, data)` 不暴露 envelope 的 `ignorable` 字段，插件无法
 * 在写入侧自保；持久化层在特定时序下会「seq 已消费但行未落盘」，在日志里留下
 * 永久 seq 缺口，任何读方（含 v0→v3 格式迁移）都会拒读整份历史（GUI 表现为
 * 「历史加载失败」）。唯一根治 = 不往会话日志写宿主词汇表之外的事件。
 *
 * 安全性：该事件是纯信息性的所有权记录，`{version, operation, id}` 自描述；
 * dsh-schedule 的 fold 天然跳过它，本插件投影按严格解码消费，把它当作
 * 「已知必需」不会让任何读者误解释日志其余部分。
 *
 * TODO(上游)：待 dsh-session 暴露 append 侧的 `ignorable` 标记后，改为写入
 * 时标记（更符合 envelope 契约），并移除本注册。
 */
export declare function registerOwnedSessionEventType(): void;
