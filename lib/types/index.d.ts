/**
 * dsh-later 宿主入口。
 *
 * 挂载职责：
 *  1. 注册 `userSchedules` 会话投影（GUI 读取任务列表的权威状态）；
 *  2. 注册 slash 命令（客户端 → host 的创建/删除/列表变更通道）；
 *  3. 为每个 root agent 注册用户工具 `user_schedule_create/list/delete`
 *     （PRD「用户工具（底层暴露）」，模型亦可调用，与 dsh-schedule 双入口互补）。
 *
 * 依赖顺序：作为 peer 依赖的 dsh-schedule 需先加载（其 agent-runtime 负责
 * 到期 dispatch + followup 注入；本插件只负责「用户接口层」）。
 * @module dsh-later
 */
import type { Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { name } from './domain.js';
/** 插件配置 schema（全可选，默认开箱即用；经 cordis config 覆盖）。 */
export declare const Config: s<Schemastery.ObjectS<{
    /** 单 session 用户任务上限。 */
    maxSchedules: s<number, number>;
}>, Schemastery.ObjectT<{
    /** 单 session 用户任务上限。 */
    maxSchedules: s<number, number>;
}>>;
/** 所需服务（延后激活，缺失时插件不加载）。 */
export declare const inject: string[];
/** 宿主持有的 settings 形状（settings getter 返回值与 register* 接受入参）。 */
export interface SchedulerSettings {
    readonly maxSchedules: number;
    readonly allowLongPrompts: boolean;
    readonly maxPromptChars: number;
}
export declare function apply(ctx: Context, config?: {
    maxSchedules?: number;
}): void;
export { name };
