/**
 * 跟随宿主 DSH 语言设置的文案 hook。
 *
 * 宿主的 `@deepseek-ai/dsh-client-locale` 在 client context 上暴露 `locale`
 * 服务（getSnapshot/subscribe，LocaleFace 形状）；本 hook 以
 * `useSyncExternalStore` 订阅其 active locale，语言切换时触发重渲染。
 * locale 服务缺失（旧宿主组合）时回退中文，行为与 v1 一致。
 * @module dsh-later/client/useSchedT
 */
import { useCallback, useSyncExternalStore } from 'react';
import { dictFor, type SchedLocaleId, type SchedStrings } from './strings.js';

/** 宿主 locale 服务的结构化子集（避免引入运行时包类型依赖）。 */
export interface LocaleFaceLike {
  /** 当前不可变快照（变更前引用稳定）。 */
  getSnapshot(): { active: string; revision: number };
  /** 订阅快照变化；返回退订函数。 */
  subscribe(fn: () => void): () => void;
}

const noopSubscribe = (): (() => void) => () => {};

export interface SchedT {
  /** 当前文案字典。 */
  t: SchedStrings;
  /** 当前语言 id（时间格式化等需要区分语言时使用）。 */
  lang: SchedLocaleId;
}

/**
 * 返回当前语言的文案字典与语言 id；宿主语言切换时组件自动重渲染。
 * @param locale 宿主 locale 服务（经插槽 inject 注入；可为 undefined）。
 */
export function useSchedT(locale: LocaleFaceLike | undefined): SchedT {
  const subscribe = useCallback(
    (onStoreChange: () => void) => (locale === undefined ? noopSubscribe() : locale.subscribe(onStoreChange)),
    [locale],
  );
  const getActive = useCallback(() => (locale === undefined ? 'zh' : locale.getSnapshot().active), [locale]);
  const active = useSyncExternalStore(subscribe, getActive);
  const lang: SchedLocaleId = active === 'en' ? 'en' : 'zh';
  return { lang, t: dictFor(active) };
}
