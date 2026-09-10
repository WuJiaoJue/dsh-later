/**
 * 宿主端专属：把本插件自有会话事件类型登记进宿主已知事件集合。
 *
 * ⚠️ 本模块只能被 host 端入口（index.ts）引用——它对
 * `@deepseek-ai/dsh-session` 有**运行时值依赖**；client 端浏览器 bundle 若经
 * 共享模块（如 domain.ts，被 `src/client/index.tsx` 引用）间接引入本模块，
 * esbuild 会尝试把宿主包（依赖 node:path/node:module）打进浏览器产物而失败。
 *
 * @module dsh-session-scheduler/owned-event-registration
 */
import { KNOWN_SESSION_EVENT_TYPES } from '@deepseek-ai/dsh-session';
import { name, OWNED_EVENT } from './domain.js';

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
export function registerOwnedSessionEventType(): void {
  try {
    // 本地 typings（dsh-session@0.1.0-rc.8）把它声明为 ReadonlySet，但运行时
    // 实现是普通可变 Set（lib/index.js 中 `new Set([...])`，未冻结），
    // 且核心文档明示插件注册面暂缓提供——此处收窄为可变引用完成登记。
    (KNOWN_SESSION_EVENT_TYPES as unknown as Set<string>).add(OWNED_EVENT);
  } catch (error) {
    // 未来核心若冻结该集合，此处降级为告警：插件功能不受影响，
    // 只是含本插件事件的旧日志仍会被无本插件上下文的读者拒绝。
    console.warn(
      `[${name}] register owned session event type failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
