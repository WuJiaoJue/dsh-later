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
 * 为什么必须注册：dsh-session 的持久化读路径在加载历史时逐条校验事件类型，
 * 不在核心白名单 `KNOWN_SESSION_EVENT_TYPES` 里且未标 `ignorable:true` 的事件
 * 会让**整份日志被拒读**（`SessionFormatUnsupportedError`，GUI 表现为「历史
 * 加载失败」）。而当前构建的 `Session.append(type, data)` 不暴露 envelope 的
 * `ignorable` 字段，插件无法在写入侧自保；核心文档也明示「下游插件的注册面
 * 暂缓提供」。因此在本插件激活时主动登记自有事件类型——任何加载了本插件的
 * 进程即可正常读取包含该事件的日志。
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
