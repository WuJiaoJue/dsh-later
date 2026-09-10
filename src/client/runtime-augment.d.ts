/**
 * 客户端 Cordis 上下文类型增强（augment @deepseek-ai/cordis 的 Context）。
 *
 * 为什么不从 dsh-client-runtime/client 或 dsh-client-ui-(settings|conversation)/client
 * 取类型：这些包是浏览器运行时注入产物，不应作为插件的 NPM 依赖（pnpm 解析
 * 它们的预发布版本会触发 hoisting / range 噪声）。宿主加载时按 dsh.client.inject
 * 配置注入服务，本文件只声明插件用到的那部分契约，足以让 typecheck 干净、
 * 不引入运行时依赖。
 *
 * 形状参考 dsh-client-runtime 0.1.1-rc.2 与 dsh-client-ui-(settings|conversation)
 * 0.1.2-rc.1 的真实公开 API（SlotRegistry、ISessions、SettingsScope、SlotMap），
 * 但仅暴露本插件调用的成员。所有缺失字段随宿主升级动态补齐，本文件不会被
 * 这些字段的存在与否所约束。
 *
 * @module dsh-session-scheduler/client/runtime-augment
 */
import type { ComponentType, ReactNode } from 'react';
import type { Context } from '@deepseek-ai/cordis';

/** 一个 slot 声明的核心字段（足够 plugin 调用；不展开 SlotMap 全部键）。
 *
 * `inject` 的返回类型故意写成 `object`：避免要求插件每次都构造
 * `Record<string, unknown>` 字面量（会与组件 props 类型互斥）；宿主渲染器
 * 实际通过「字段名 → 组件 prop / hook」的桥接表分发，类型安全由组件 prop
 * 类型自身保证。
 */
export interface ClientSlotDeclaration {
  readonly name: string;
  readonly id?: string;
  readonly key?: string;
  readonly order?: number;
  readonly locale?: string;
  readonly inject?: () => object;
}

/** slot 注入字段的最小契约（每个字段会被宿主转成 prop / hook）。 */
export interface ClientSlotInjectFace {
  [field: string]: unknown;
}

/** 客户端 SlotRegistry 的最小视图（slot 注册 + 生命周期）。 */
export interface ClientSlotRegistry {
  inject(
    key: string,
    callback: () => unknown | Iterable<() => void>,
  ): () => void;
  register<T = unknown>(
    declaration: ClientSlotDeclaration,
    component: ComponentType<T>,
  ): () => void;
}

/** 客户端会话面：足够 callCommand 链路使用；不暴露全部 ISessions。 */
export interface ClientSessionFace {
  command(line: string): Promise<{
    ok?: boolean;
    value?: { matched?: boolean; [k: string]: unknown };
    [k: string]: unknown;
  } | undefined>;
}

/** Agent-scoped 上下文视图（运行时返回真正的 Context；这里只用到 type guard）。 */
export type ClientAgentContext = Context;

export interface ClientSessionsService {
  scope(id: string): ClientAgentContext | undefined;
  sessionOf(ctx: ClientAgentContext): ClientSessionFace | undefined;
  list?: {
    getSnapshot(): { byId: Readonly<Record<string, unknown>> };
    subscribe(fn: () => void): () => void;
  };
  refresh?: () => Promise<unknown>;
}

/** 设置 namespace scope（取自 dsh-client-ui-settings 0.1.2-rc.1 的 SettingsScope）。 */
export interface ClientSettingsScopeSnapshot<T> {
  readonly status: 'loading' | 'ready' | 'unavailable';
  readonly value: T | undefined;
  readonly base: unknown;
  readonly user: unknown;
  readonly writable: boolean;
}

export interface ClientSettingsScope<T = unknown> {
  getSnapshot(): ClientSettingsScopeSnapshot<T>;
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<void>;
  unset(field: string): Promise<void>;
}

export interface ClientSettingsScopeService {
  bind(spec: { namespace: string }): ClientSettingsScope;
  describe?(): unknown;
}

/** Locale 服务：register 注册命名空间字典、bind 取出 `t(key)` 函数。 */
export interface ClientLocaleService {
  register(
    namespace: string,
    dictionaries: Readonly<Record<string, Record<string, string>>>,
  ): () => void;
  bind(namespace: string): (key: string) => string;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: ClientSlotRegistry;
    sessions: ClientSessionsService;
    settingsScope: ClientSettingsScopeService;
    locale: ClientLocaleService;
    conversation?: unknown;
  }
}
