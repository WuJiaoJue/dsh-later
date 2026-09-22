window.__ModuleLoader__.load({
	id: "dsh-later",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/domain.ts
var name = "dsh-later";

// src/client/styles.ts
var STYLE_ID = "dsh-later-styles";
var COMPONENTS = [
  "/* ==================== \u8F93\u5165\u884C\u5BB9\u5668 ==================== */",
  ".ss-sched-row { display: inline-flex; align-items: center; gap: 4px; flex: none; }",
  "",
  "/* ==================== \u23F0 \u6309\u94AE\uFF08\u8F93\u5165\u6846\u53F3\u4FA7\u5DE5\u5177\u6309\u94AE\uFF09 ==================== */",
  "/* \u5BF9\u9F50\u5B98\u65B9 ui-conversation trigger\uFF1A28\xD728\u3001secondary \u8272\u3001hover interactive-bg-hover */",
  ".ss-sched-btn {",
  "  display: inline-grid; place-items: center; width: 28px; height: 28px;",
  "  border: none; border-radius: 999px; cursor: pointer; padding: 0;",
  "  color: var(--dsw-alias-label-secondary); background: transparent;",
  "  transition: background var(--ds-transition-duration-fast) var(--ds-ease-in-out);",
  "}",
  ".ss-sched-btn:hover:not(:disabled) {",
  "  background: var(--dsw-alias-interactive-bg-hover);",
  "}",
  ".ss-sched-btn:focus-visible {",
  "  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px;",
  "}",
  ".ss-sched-btn:disabled {",
  "  cursor: default; color: var(--dsw-alias-label-dimmed); opacity: 0.4;",
  "}",
  ".ss-sched-btn.ss-active {",
  "  background: var(--dsw-alias-interactive-bg-active);",
  "}",
  "",
  "/* ==================== \u5F85\u53D1\u9001\u63D0\u9192 dock\uFF08\u50CF\u7D20\u7EA7\u5BF9\u9F50 QueueDock\uFF1B\u884C\u5185\u4FDD\u7559 boss \u8FDB\u5EA6\u6761\uFF09 ==================== */",
  "/* \u5916\u58F3\u51E0\u4F55\u4E0E QueueDock .dock \u4E00\u81F4\uFF08\u542B\u8D1F\u4E0B\u8FB9\u8DDD\u8D34\u4F4F composer \u6808\uFF09\u3002 */",
  ".ss-dock-root {",
  "  box-sizing: border-box; flex: none;",
  "  width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance)",
  "    - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));",
  "  max-width: calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));",
  "  margin: 0 auto calc(0px - var(--dsh-composer-stack-gap) - 3px);",
  "  padding: 0 var(--dsh-composer-dock-inset);",
  "}",
  "/* \u9762\u677F\u4E0E QueueDock .panel \u4E00\u81F4\uFF1Abg tip\u3001\u9876\u90E8\u5706\u89D2\u3001::after \u753B\u63CF\u8FB9\uFF08\u7559\u5E95\u8FB9\u5F00\u53E3\uFF09\u3002 */",
  ".ss-dock-body {",
  "  position: relative; overflow: hidden; width: 100%; padding: 2px 0;",
  "  background: var(--dsw-specific-tip);",
  "  border-radius: 12px 12px 0 0;",
  "  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);",
  "  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);",
  "}",
  ".ss-dock-body::after {",
  "  content: ''; position: absolute; inset: 0; pointer-events: none;",
  "  border: 1px solid var(--dsw-alias-border-l1); border-bottom: none; border-radius: inherit;",
  "}",
  ".ss-dock-header {",
  "  box-sizing: border-box; display: flex; align-items: center; gap: 10px;",
  "  width: 100%; height: 36px; padding: 4px 12px;",
  "  background: none; border: none; border-radius: 8px; cursor: pointer; text-align: left;",
  "  color: var(--dsw-alias-label-primary);",
  "}",
  ".ss-dock-header:focus-visible { outline: 2px solid var(--dsw-alias-label-tertiary); outline-offset: -2px; }",
  ".ss-dock-lead { display: grid; place-items: center; color: var(--dsw-alias-label-tertiary); flex: none; }",
  ".ss-dock-count {",
  "  flex: auto; min-width: 0;",
  "  font-family: Inter, var(--dsw-font-family);",
  "  font-size: 13px; font-weight: 500; line-height: 24px;",
  "}",
  ".ss-dock-chevron { display: grid; place-items: center; width: 14px; height: 14px; color: var(--dsw-alias-label-tertiary); flex: none; }",
  ".ss-dock-chevron.ss-open { transform: rotate(180deg); }",
  ".ss-dock-list {",
  "  margin: 0; padding: 0; list-style: none;",
  "  max-height: 180px; overflow-y: auto;",
  "}",
  ".ss-dock-row {",
  "  box-sizing: border-box; display: flex; align-items: center; gap: 10px;",
  "  width: 100%; min-height: 36px; padding: 4px 5px 4px 12px; border-radius: 8px;",
  "}",
  ".ss-dock-row + .ss-dock-row { box-shadow: inset 0 1px 0 var(--dsw-alias-border-l1); }",
  "/* QueueDock \u7684 preview \u662F\u5355\u884C\u6587\u672C\uFF1B\u540C\u4F4D\u653E\u300C\u65F6\u95F4 \xB7 \u5012\u8BA1\u65F6 \xB7 \u5185\u5BB9\u300D+ boss \u8FDB\u5EA6\u6761\uFF08\u4FDD\u7559\u63D2\u4EF6\u7279\u6027\uFF09\u3002 */",
  ".ss-dock-preview {",
  "  flex: auto; min-width: 0; display: flex; flex-direction: column; gap: 4px;",
  "  font: var(--dsw-font-xs-13); font-family: Inter, var(--dsw-font-family);",
  "}",
  ".ss-dock-row-line { display: flex; align-items: center; gap: 8px; min-width: 0; }",
  ".ss-dock-row-time { flex: none; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }",
  ".ss-dock-row-countdown { flex: none; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }",
  ".ss-dock-row-countdown.ss-due { color: var(--dsw-alias-state-warn-secondary); }",
  ".ss-dock-row-prompt {",
  "  flex: 1; min-width: 0; color: var(--dsw-alias-label-primary-dimmed);",
  "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
  "}",
  "/* boss \u8840\u6761\uFF08\u4FDD\u7559\uFF09\uFF1A\u5355\u6839\u957F\u7BA1 + \u7B49\u6BD4\u5206\u9694\u7EBF\uFF08\u6BCF\u6BB5 1h\uFF09\u3002 */",
  ".ss-dock-bars { display: block; }",
  ".ss-dock-bar {",
  "  position: relative; height: 6px; border-radius: 999px; overflow: hidden;",
  "  background: var(--dsw-alias-line-secondary);",
  "  --ss-bar-divider: color-mix(in srgb, var(--dsw-alias-label-primary) 35%, transparent);",
  "}",
  ".ss-dock-bars-compact .ss-dock-bar { height: 4px; }",
  ".ss-dock-bar-fill {",
  "  position: relative; z-index: 1;",
  "  height: 100%; border-radius: 999px; background: var(--dsw-alias-brand-primary);",
  /* 活动期的推进由 CSS 动画驱动（见 ScheduleDock 的 fillStyle）：
     旧实现是「每秒 tick 改一次宽度 + transition 补间」，1 分钟任务每秒跳约 8px，
     肉眼可见锯齿。改为动画后由合成器逐帧插值，真 60fps 且零重渲染。
     这里**不保留** transition: width —— 它与动画叠加会造成双重补间、反而更抖。 */
  "  /* \u6781\u77ED\u4EFB\u52A1/\u65E9\u671F\u6682\u505C\u65F6\u8FDB\u5EA6\u6BD4\u63A5\u8FD1 0\uFF1A\u7ED9\u6700\u5C0F\u53EF\u89C1\u5BBD\u5EA6\uFF0C\u4E14 active \u4E0E paused \u540C\u4E00\u89C4\u5219\uFF0C",
  "     \u907F\u514D\u6682\u505C\u524D\u540E\u4FDD\u5E95\u9608\u503C\u4E0D\u4E00\u81F4\u5BFC\u81F4\u6761\u957F\u8DF3\u53D8\u3002 */",
  "  min-width: 10px;",
  "}",
  "/* \u6682\u505C hatch\uFF1A\u51E0\u4F55\u5BF9\u9F50 demo\uFF086px \u8F68\u9053\u3001\u53EA\u6539 fill\u3001115\xB0 5px \u6761\u7EB9\uFF09\uFF0C",
  "   \u4F46\u6697\u8272\u4E3B\u9898\u4E0B alias-line-secondary \u51E0\u4E4E\u8D34\u80CC\u666F\u2014\u2014fill \u7528\u66F4\u9AD8\u5BF9\u6BD4\u6761\u7EB9 +",
  "   \u7565\u6DF1\u5E95\uFF0C\u8F68\u9053\u4E0D\u52A8\uFF0C\u907F\u514D\u50CF\u6362\u4E86\u53E6\u4E00\u5957\u7EC4\u4EF6\u3002 */",
  /* 进度推进关键帧：从 0 线性走到 100%；配合负 animation-delay 把播放头
     拉到当前进度（等价于「已过去/总窗口」）。 */
  "@keyframes ss-dock-bar-progress { from { width: 0%; } to { width: 100%; } }",
  "@media (prefers-reduced-motion: reduce) {",
  "  /* \u65E0\u969C\u788D\uFF1A\u5173\u6389\u9010\u5E27\u63A8\u8FDB\uFF0C\u9000\u56DE\u300C\u9759\u6001\u5BBD\u5EA6 + \u65E0\u52A8\u753B\u300D\u3002",
  "     \u6CE8\u610F\u6B64\u65F6\u5BBD\u5EA6\u7531 animation-fill-mode \u51B3\u5B9A\u4F1A\u505C\u5728 0\uFF0C\u6545\u7531 JS \u4FA7\u6539\u4E3A\u76F4\u63A5\u7ED9 width\uFF1B",
  "     \u8FD9\u91CC\u53EA\u9700\u7981\u7528\u52A8\u753B\u672C\u8EAB\u3002 */",
  "  .ss-dock-bar-fill { animation: none !important; }",
  "}",
  ".ss-dock-row.ss-paused .ss-dock-bar-fill {",
  "  background:",
  "    repeating-linear-gradient(",
  "      115deg,",
  "      var(--dsw-alias-label-secondary, #9aa0a8) 0 5px,",
  "      transparent 5px 10px",
  "    ),",
  "    color-mix(in srgb, var(--dsw-alias-label-tertiary, #6b7280) 55%, var(--dsw-alias-line-secondary, #3a3e46));",
  "  opacity: 1;",
  "  transition: none;",
  "}",
  ".ss-dock-row.ss-paused .ss-dock-row-countdown { color: var(--dsw-alias-label-tertiary); }",
  ".ss-dock-row.ss-paused .ss-dock-row-time,",
  ".ss-dock-row.ss-paused .ss-dock-row-prompt { color: var(--dsw-alias-label-secondary); }",
  ".ss-dock-action.ss-paused-active { color: var(--dsw-alias-state-success-primary); }",
  "/* \u5206\u9694\u7EBF\uFF1Aabsolute \u8DE8\u6574\u4E2A bar \u753B N-1 \u6761\u7B49\u6BD4\u7AD6\u7EBF\uFF0C\u6E32\u67D3\u5728 fill \u4E4B\u524D\uFF08fill \u7528 z-index:1 \u76D6\u4F4F\u300C\u5DF2\u586B\u5145\u6BB5\u300D\u4E0A\u7684\u523B\u5EA6\uFF09\u3002 */",
  ".ss-dock-bar-divider {",
  "  position: absolute; inset: 0; pointer-events: none;",
  "  background-repeat: no-repeat;",
  "}",
  ".ss-dock-actions { display: flex; align-items: center; gap: 10px; flex: none; }",
  ".ss-dock-action {",
  "  display: grid; place-items: center; width: 28px; height: 28px; padding: 0; flex: none;",
  "  border: none; border-radius: 999px; background: none; cursor: pointer;",
  "  color: var(--dsw-alias-label-tertiary);",
  "}",
  ".ss-dock-action:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }",
  ".ss-dock-action:focus-visible { outline: 2px solid var(--dsw-alias-label-tertiary); outline-offset: -2px; }",
  ".ss-dock-action:disabled { cursor: default; opacity: 0.45; }",
  "/* \u63D2\u8BDD\u5B8C\u6210\u6001\uFF1AQueueDock \u65E0\u6B64\u6001\uFF0C\u7528\u6210\u529F\u8272\u505A\u8F7B\u63D0\u793A\uFF08\u53E0\u52A0 disabled \u534A\u900F\u660E\uFF09\u3002 */",
  ".ss-dock-action-steer.ss-done { color: var(--dsw-alias-state-success-primary); }",
  ".ss-dock-steer-err {",
  "  color: var(--dsw-alias-state-warn-secondary); font-size: 12px; line-height: 16px;",
  "}",
  "/* \u884C\u5185\u7F16\u8F91\uFF08QueueDock .editor \u540C\u6B3E\u8F93\u5165\u6846\uFF09\u3002 */",
  ".ss-dock-edit-input {",
  "  box-sizing: border-box; flex: auto; min-width: 0; height: 28px; padding: 0 8px;",
  "  font: var(--dsw-font-xs-13); font-family: Inter, var(--dsw-font-family);",
  "  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);",
  "  border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; outline: none;",
  "}",
  ".ss-dock-edit-input:focus { border-color: var(--dsw-alias-state-business-primary); }",
  ".ss-dock-row-save {",
  "  flex: none; font-size: 12px; line-height: 20px; padding: 0 8px; border-radius: 6px;",
  "  border: 1px solid var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary);",
  "  background: transparent; cursor: pointer;",
  "}",
  ".ss-dock-row-save:disabled { opacity: 0.45; cursor: default; }",
  ".ss-dock-edit-err {",
  "  flex-basis: 100%; color: var(--dsw-alias-state-error-secondary); font-size: 12px; line-height: 16px;",
  "}",
  ".ss-dock-editing { flex-wrap: wrap; }",
  "",
  "/* ==================== \u9762\u677F ==================== */",
  "/* \u5BF9\u9F50\u5B98\u65B9 popover panel\uFF1Az-index 100\u3001border-inverted\u3001radius 12\u3001\u5B57\u53F7 12\u3001secondary \u6587\u5B57 */",
  ".ss-backdrop {",
  "  position: fixed; inset: 0; z-index: 100; background: transparent;",
  "}",
  ".ss-panel {",
  "  position: fixed; z-index: 101;",
  "  width: min(340px, calc(100vw - 24px));",
  "  background: var(--dsw-specific-menu);",
  "  color: var(--dsw-alias-label-secondary);",
  "  border: 1px solid var(--dsw-alias-border-inverted); border-radius: 12px;",
  "  box-shadow: var(--dsw-shadow-lv3); padding: 12px; box-sizing: border-box;",
  "  font-size: 12px; line-height: 20px; font-family: var(--dsw-font-family);",
  "}",
  ".ss-panel-header {",
  "  display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;",
  "}",
  ".ss-panel-title {",
  "  font-weight: 500; font-size: 13px;",
  "  display: inline-flex; align-items: center; gap: 6px;",
  "  color: var(--dsw-alias-label-primary);",
  "}",
  ".ss-panel-close {",
  "  width: 24px; height: 24px; border: none; background: transparent;",
  "  cursor: pointer; color: var(--dsw-alias-label-tertiary);",
  "  border-radius: 999px; display: grid; place-items: center; padding: 0;",
  "}",
  ".ss-panel-close:hover {",
  "  background: var(--dsw-alias-interactive-bg-hover);",
  "  color: var(--dsw-alias-label-secondary);",
  "}",
  ".ss-panel-close:focus-visible {",
  "  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px;",
  "}",
  "",
  "/* ==================== \u5FEB\u6377\u82AF\u7247\uFF08\u5355\u89C6\u56FE\uFF0C\u65E0 tab\uFF09 ==================== */",
  ".ss-quick-grid {",
  "  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;",
  "}",
  ".ss-quick-chip {",
  "  height: 30px; padding: 0 10px;",
  "  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;",
  "  background: transparent; color: var(--dsw-alias-label-secondary);",
  "  cursor: pointer; font-size: 12px; line-height: 1.5; font-family: var(--dsw-font-family);",
  "  transition: color var(--ds-transition-duration-fast) var(--ds-ease-in-out),",
  "              border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),",
  "              background var(--ds-transition-duration-fast) var(--ds-ease-in-out);",
  "}",
  ".ss-quick-chip:hover {",
  "  color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-dimmed);",
  "}",
  ".ss-quick-chip.ss-active {",
  "  background: var(--dsw-alias-interactive-bg-active);",
  "  color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);",
  "}",
  ".ss-quick-chip:focus-visible {",
  "  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;",
  "}",
  ".ss-custom-row {",
  "  display: flex; gap: 6px; margin-top: 8px;",
  "}",
  ".ss-custom-row .ss-input { flex: 1; min-width: 0; }",
  ".ss-tasklist-head { margin-top: 10px; }",
  "",
  "/* ==================== \u8868\u5355\u5B57\u6BB5 ==================== */",
  "/* \u5BF9\u9F50\u5B98\u65B9 fields.module.css\uFF1Acolumn \u5E03\u5C40\u3001label \u5728\u4E0A 13px/500\u3001\u5B57\u6BB5\u95F4 border-top \u5206\u9694 */",
  ".ss-field {",
  "  display: flex; flex-direction: column; gap: 6px; padding: 12px 0;",
  "}",
  ".ss-field + .ss-field { border-top: 1px solid var(--dsw-alias-border-l2); }",
  ".ss-input {",
  "  height: 34px; padding: 0 12px;",
  "  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;",
  "  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);",
  "  font-size: 13px; line-height: 1.5; font-family: var(--dsw-font-family);",
  "  flex: 1; min-width: 0; width: 100%; box-sizing: border-box;",
  "}",
  ".ss-input:focus-visible {",
  "  border-color: var(--dsw-alias-brand-primary); outline: none;",
  "}",
  ".ss-input:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }",
  ".ss-input.ss-inputInvalid { border-color: var(--dsw-alias-label-error); }",
  "",
  "/* ==================== \u4EFB\u52A1\u5217\u8868 ==================== */",
  ".ss-tasks { max-height: 160px; overflow-y: auto; margin-bottom: 8px; }",
  ".ss-task {",
  "  display: flex; align-items: center; gap: 8px; padding: 5px 6px;",
  "  border-radius: 4px; font-size: 12px;",
  "  transition: background var(--ds-transition-duration-fast) var(--ds-ease-in-out);",
  "}",
  ".ss-task:hover { background: var(--dsw-alias-interactive-bg-hover); }",
  ".ss-dot { width: 6px; height: 6px; border-radius: 999px; flex: none; }",
  ".ss-dot.scheduled { background: var(--dsw-alias-brand-primary); }",
  ".ss-dot.overdue { background: var(--dsw-alias-state-warn-secondary); }",
  ".ss-dot.delivered { background: var(--dsw-alias-state-success-primary); }",
  ".ss-dot.cancelled { background: var(--dsw-alias-label-dimmed); }",
  ".ss-task-status {",
  "  display: inline-block; margin-left: 4px; padding: 0 5px;",
  "  border-radius: 999px; font-size: 10px; font-weight: 500;",
  "  color: var(--dsw-alias-state-warn-label);",
  "  background: var(--dsw-alias-state-warn-tertiary);",
  "}",
  ".ss-task-main { flex: 1; min-width: 0; }",
  ".ss-task-time { color: var(--dsw-alias-label-tertiary); font-size: 11px; }",
  ".ss-task-prompt {",
  "  color: var(--dsw-alias-label-primary);",
  "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
  "}",
  ".ss-task.cancelled .ss-task-prompt,",
  ".ss-task.cancelled .ss-task-time {",
  "  text-decoration: line-through; color: var(--dsw-alias-label-dimmed);",
  "}",
  ".ss-task-del {",
  "  flex: none; width: 20px; height: 20px; border: none; background: transparent;",
  "  cursor: pointer; color: var(--dsw-alias-label-tertiary);",
  "  border-radius: 999px; display: grid; place-items: center; padding: 0;",
  "  opacity: 0;",
  "  transition: opacity var(--ds-transition-duration-fast) var(--ds-ease-in-out),",
  "              background var(--ds-transition-duration-fast) var(--ds-ease-in-out),",
  "              color var(--ds-transition-duration-fast) var(--ds-ease-in-out);",
  "}",
  ".ss-task:hover .ss-task-del { opacity: 1; }",
  ".ss-task-del:hover {",
  "  background: var(--dsw-alias-interactive-bg-hover-danger);",
  "  color: var(--dsw-alias-state-error-secondary);",
  "}",
  ".ss-task-del:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); opacity: 1; }",
  ".ss-empty {",
  "  color: var(--dsw-alias-label-tertiary); text-align: center;",
  "  padding: 10px 0; font-size: 12px;",
  "}",
  "",
  "/* ==================== \u5E95\u90E8\u64CD\u4F5C\u680F ==================== */",
  "/* \u5BF9\u9F50\u5B98\u65B9\u6309\u94AE\u89C4\u683C\uFF1Aradius 8\u3001padding 5px 14px\u300113px\u3001disabled opacity .4 */",
  ".ss-footer { display: flex; gap: 8px; align-items: center; }",
  ".ss-confirm {",
  "  flex: 1; appearance: none; border: 1px solid transparent; border-radius: 8px;",
  "  padding: 5px 14px; cursor: pointer;",
  "  background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3);",
  "  font-size: 13px; line-height: 1.5; font-weight: 500;",
  "  transition: background var(--ds-transition-duration-fast) var(--ds-ease-in-out);",
  "  font-family: var(--dsw-font-family);",
  "}",
  ".ss-confirm:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }",
  ".ss-confirm:disabled { opacity: 0.4; cursor: default; }",
  ".ss-confirm:focus-visible {",
  "  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;",
  "}",
  ".ss-clear {",
  "  flex: none; appearance: none; border: 1px solid var(--dsw-alias-border-l2);",
  "  border-radius: 8px; padding: 5px 14px; background: none;",
  "  color: var(--dsw-alias-label-secondary); cursor: pointer;",
  "  font-size: 13px; line-height: 1.5; font-family: var(--dsw-font-family);",
  "}",
  ".ss-clear:hover:not(:disabled) {",
  "  color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-dimmed);",
  "}",
  ".ss-clear:disabled { opacity: 0.4; cursor: default; }",
  ".ss-clear:focus-visible {",
  "  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;",
  "}",
  "",
  "/* ==================== \u9519\u8BEF\u63D0\u793A ==================== */",
  "/* \u5BF9\u9F50\u5B98\u65B9\uFF1A\u7EAF\u6587\u5B57\u8272\u3001\u65E0\u80CC\u666F\u8272\u5757\uFF1Bhint 12px */",
  ".ss-error {",
  "  color: var(--dsw-alias-state-error-primary); font-size: 12px;",
  "  line-height: 1.5; margin: 0;",
  "}",
  ".ss-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 1.5; margin: 0; }",
  "",
  "/* ==================== \u4FA7\u680F\u4F1A\u8BDD\u884C\u300C\u5B9A\u65F6\u72B6\u6001\u300Dbadge\uFF08docs/ui/09 \u8DEF\u7EBF B\uFF09 ==================== */",
  "/* \u7D2B\u4E3A\u5B9A\u65F6\u4E13\u5C5E\uFF08\u6D45\u6DF1\u901A\u7528\uFF0C\u5BF9\u767D/\u6DF1\u5E95\u5BF9\u6BD4\u5747 \u22653:1\uFF09\uFF1Burgent/overdue \u590D\u7528\u5BBF\u4E3B warn/error \u522B\u540D\u3002 */",
  ".ss-presence { display: inline-flex; flex: none; color: #8b5cf6; }",
  ".ss-presence-beside { margin-left: 4px; }",
  ".ss-presence rect { fill: currentColor; }",
  ".ss-presence .ss-presence-ring { opacity: 0.8; animation: ss-presence-breathe 2.4s var(--ds-ease-in-out, ease-in-out) infinite; }",
  ".ss-presence .ss-presence-hand { opacity: 1; }",
  '.ss-presence[data-state="urgent"] { color: var(--dsw-alias-state-warn-secondary); }',
  '.ss-presence[data-state="urgent"] .ss-presence-ring { animation-name: ss-presence-pulse; animation-duration: 0.9s; }',
  '.ss-presence[data-state="overdue"] { color: var(--dsw-alias-state-error-primary); }',
  '.ss-presence[data-state="overdue"] .ss-presence-ring { animation: none; }',
  "@keyframes ss-presence-breathe { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }",
  "@keyframes ss-presence-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }",
  "@media (prefers-reduced-motion: reduce) { .ss-presence .ss-presence-ring { animation: none; } }",
  "",
  "/* ==================== \u60AC\u6D6E\u5361\u7247\u72B6\u6001\u884C\u589E\u8865\uFF08issue #4\uFF09 ==================== */",
  "/* \u4E0E\u5BBF\u4E3B .hoverStatus \u884C\u4E25\u683C\u540C\u6784\u3002\u5BBF\u4E3B StateDot \u5B9E\u6D4B\u7ED3\u6784\uFF08dsh-client-ui-primitives",
  "   \u7684 ._dot_* \u8FD0\u884C\u65F6\u6837\u5F0F\uFF0C10\xD710 relative + ::before 10px/inset:0 + ::after 6px/inset:2px\uFF0C",
  "   \u4E24\u5C42\u540C\u8272 \u2192 \u89C6\u89C9\u76F4\u5F84\u7EA6 8px\uFF09\uFF1A\u672C\u63D2\u4EF6\u6309\u4E0B\u8FF0\u540C\u6837\u7684\u53CC\u5C42\u5199\u6CD5\u81EA\u7ED8\uFF0C\u907F\u514D\u590D\u7528\u5176\u6784\u5EFA\u671F hash",
  "   \u7C7B\u540D\uFF08_dot_xxxxxx_n \u4E0D\u7A33\u5B9A\uFF0C\u5BBF\u4E3B\u5347\u7EA7\u4F1A\u9759\u9ED8\u5931\u6548\uFF09\u3002",
  "   \u989C\u8272\u8DDF\u968F\u5BBF\u4E3B\u8BED\u4E49\u8272\u677F\uFF0C\u4E0D\u5F15\u5165\u63D2\u4EF6\u4E13\u5C5E\u8272\u2014\u2014\u6587\u6848\u5DF2\u8BF4\u660E\u662F\u5B9A\u65F6\u63D0\u9192\uFF0C\u70B9\u4E0D\u5FC5\u518D\u627F\u62C5",
  "   \u300C\u533A\u5206\u6765\u6E90\u300D\u7684\u804C\u8D23\uFF1B\u6DF7\u5165\u7B2C\u4E94\u79CD\u989C\u8272\u53CD\u800C\u4E0E\u5BBF\u4E3B warning \u8BED\u4E49\u649E\u8F66\u3002",
  "",
  "   \u26A0\uFE0F \u5DF2\u77E5\u9650\u5236\uFF08\u6D45\u8272\u9002\u914D\u5C1A\u672A\u5904\u7406\uFF09\uFF1A\u4EE5\u4E0B\u8272\u503C\u662F\u5728**\u5F53\u524D\u6DF1\u8272\u4E3B\u9898**\u4E0B\u4ECE\u5BBF\u4E3B",
  "   \u5B9E\u6D4B\u5F97\u5230\u7684\u8FD0\u884C\u65F6\u503C\uFF0C\u5BBF\u4E3B\u81EA\u8EAB\u5F15\u7528 --dsw-alias-* token\uFF0C\u4F1A\u968F\u4E3B\u9898\u53D8\u5316\uFF0C",
  "   \u800C\u6B64\u5904\u662F\u786C\u7F16\u7801\u5E38\u91CF\u3002\u56E0\u6B64\u5F53\u524D\u4EC5\u5728\u6DF1\u8272\u4E3B\u9898\u4E0B\u4E0E\u5BBF\u4E3B\u4E00\u81F4\uFF1B\u5207\u6362\u5230\u6D45\u8272\u4E3B\u9898/",
  "   \u5176\u4ED6\u914D\u8272\u65B9\u6848\u65F6\uFF0C\u672C\u884C\u4E0D\u4F1A\u8DDF\u968F\uFF0C\u53EF\u80FD\u4E0E\u8BE5\u5361\u7247\u5176\u4F59\u5185\u5BB9\u4E0D\u540C\u6B65\u3002",
  "   \u4FEE\u6CD5\uFF1A\u5B9E\u6D4B\u6D45\u8272\u4E3B\u9898\u4E0B\u8BE5\u5361\u7247\u7684\u5B9E\u9645\u5E95\u8272\u540E\uFF0C\u6539\u7528\u5BF9\u5E94 token\uFF08\u5F85\u529E\uFF09\u3002 */",
  ".ss-hover-status {",
  "  display: flex; align-items: center; gap: 8px;",
  "  color: #adb2b8; font-size: 12px; line-height: 20px;",
  "}",
  "/* \u72B6\u6001\u70B9\uFF1A\u5BBF\u4E3B\u540C\u6B3E\u53CC\u5C42\u7ED3\u6784\u3002\u5173\u952E\u2014\u2014::before \u662F 10% \u900F\u660E\u5EA6\u7684**\u5149\u6655**\uFF0C",
  "   \u4E0D\u662F\u5B9E\u5FC3\u5916\u73AF\uFF1B::after \u624D\u662F 6px \u5B9E\u5FC3\u6838\u5FC3\u3002\u82E5 ::before \u4E0D\u8BBE opacity\uFF0C",
  "   \u5B83\u4F1A\u76D6\u4F4F\u6838\u5FC3\u5E76\u6E32\u67D3\u6210 10px \u5B9E\u5FC3\u5706\uFF08\u6BD4\u5BBF\u4E3B\u660E\u663E\u504F\u5927\u504F\u5B9E\uFF09\u3002 */",
  ".ss-hover-status-dot {",
  "  position: relative; display: block; flex: none;",
  "  width: 10px; height: 10px;",
  "  color: #adb2b8;",
  "}",
  ".ss-hover-status-dot::before,",
  ".ss-hover-status-dot::after {",
  '  content: ""; position: absolute; border-radius: 50%; background: currentColor;',
  "}",
  ".ss-hover-status-dot::before { inset: 0; opacity: 0.1; }",
  ".ss-hover-status-dot::after { inset: 2px; }",
  "/* \u8BED\u4E49\u6620\u5C04\uFF08\u5BF9\u9F50\u5BBF\u4E3B done/ongoing/warning/error \u56DB\u6001\u8272\u503C\uFF09\uFF1A",
  "   scheduled \u2192 ongoing \u7070\uFF08\u4E2D\u6027\uFF1A\u5DF2\u6392\u671F\uFF0C\u65E0\u7D27\u8FEB\u6027\uFF09",
  "   urgent    \u2192 warning \u7425\u73C0\uFF08\u22645min \u5373\u5C06\u89E6\u53D1\uFF09",
  "   overdue   \u2192 error \u7EA2\uFF08\u5DF2\u5230\u671F\uFF0C\u7B49\u5F85\u4F1A\u8BDD\u7A7A\u95F2\u53D1\u9001\uFF09 */",
  '.ss-hover-status[data-state="urgent"] .ss-hover-status-dot { color: #f59e0b; }',
  '.ss-hover-status[data-state="overdue"] .ss-hover-status-dot { color: #f25a5a; }',
  "",
  "/* ==================== \u8BBE\u7F6E\u9875\uFF08\u5B9A\u65F6\u63D0\u9192\u5361\u7247\uFF09 ==================== */",
  "/* \u89C6\u89C9\u5BF9\u9F50\u5B98\u65B9 PluginCard\uFF08dsh-client-ui-settings-plugins \u79C1\u6709\u7EC4\u4EF6\uFF0C\u540C\u6784\u81EA\u5B9E\u73B0\uFF0C",
  "   \u53C2\u8003 dsh-wakatime \u540C\u6B3E\u505A\u6CD5\uFF09\uFF1A<li> \u5916\u6846\u3001header \u6574\u5361\u6309\u94AE\u3001chevron\u3001\u6298\u53E0 body\u3001",
  "   footer \u653E\u5F03/\u4FDD\u5B58\u3002\u7C7B\u540D\u7EDF\u4E00 ss-card- \u524D\u7F00\uFF0C\u907F\u514D\u4E0E\u9762\u677F\uFF08ss-footer/ss-field-*\uFF09\u51B2\u7A81\u3002 */",
  ".ss-card {",
  "  border: 1px solid var(--dsw-alias-border-l2);",
  "  background: var(--dsw-alias-bg-layer-3);",
  "  border-radius: 12px; list-style: none;",
  "  transition: border-color .16s, background .16s;",
  "}",
  ".ss-card:hover { border-color: var(--dsw-alias-label-dimmed); }",
  ".ss-cardOpen { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-label-dimmed); }",
  ".ss-card-header {",
  "  appearance: none; width: 100%; font: inherit; color: inherit; text-align: left;",
  "  cursor: pointer; background: none; border: 0; border-radius: 12px;",
  "  align-items: center; gap: 12px; padding: 14px 16px; display: flex;",
  "}",
  ".ss-card-header:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }",
  ".ss-card-headText { flex-direction: column; flex: 1; gap: 4px; min-width: 0; display: flex; }",
  ".ss-card-name { color: var(--dsw-alias-label-primary); font-size: 15px; font-weight: 600; line-height: 1.4; }",
  ".ss-card-description { color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 1.5; }",
  ".ss-card-chevron { color: var(--dsw-alias-label-tertiary); flex: none; transition: transform .16s; }",
  ".ss-card-chevronOpen { transform: rotate(180deg); }",
  ".ss-card-body { border-top: 1px solid var(--dsw-alias-border-l2); margin: 0 16px; padding-bottom: 8px; }",
  ".ss-card-readOnly { color: var(--dsw-alias-label-tertiary); margin: 12px 0 0; font-size: 12px; line-height: 1.5; }",
  ".ss-card-pending {",
  "  white-space: nowrap; background: var(--dsw-alias-bg-module-platform);",
  "  color: var(--dsw-alias-label-secondary); border-radius: 999px; flex: none;",
  "  padding: 1px 8px; font-size: 11px; font-weight: 500; line-height: 17px;",
  "}",
  ".ss-card-fieldHead { align-items: center; gap: 8px; display: flex; }",
  ".ss-card-label {",
  "  min-width: 0; color: var(--dsw-alias-label-primary); flex: 1;",
  "  font-size: 13px; font-weight: 500; line-height: 1.5;",
  "}",
  ".ss-card-badges { align-items: center; gap: 8px; display: inline-flex; }",
  ".ss-card-badge {",
  "  white-space: nowrap; background: var(--dsw-alias-bg-module-platform);",
  "  color: var(--dsw-alias-label-secondary); border-radius: 999px;",
  "  padding: 1px 8px; font-size: 11px; font-weight: 500; line-height: 17px;",
  "}",
  ".ss-card-reset {",
  "  font: inherit; color: var(--dsw-alias-label-secondary); cursor: pointer;",
  "  background: none; border: none; padding: 0; font-size: 12px; line-height: 1.5;",
  "}",
  ".ss-card-reset:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }",
  ".ss-card-reset:disabled { cursor: default; }",
  ".ss-card-invalid { color: var(--dsw-alias-label-error); margin: 0; font-size: 12px; line-height: 1.5; }",
  ".ss-card-footer {",
  "  border-top: 1px solid var(--dsw-alias-border-l2);",
  "  justify-content: flex-end; align-items: center; gap: 8px;",
  "  padding: 12px 0 4px; display: flex;",
  "}",
  ".ss-card-failed {",
  "  min-width: 0; color: var(--dsw-alias-label-error); flex: 1; margin: 0;",
  "  font-size: 12px; line-height: 1.5;",
  "}",
  ".ss-card-discard, .ss-card-save {",
  "  appearance: none; font: inherit; cursor: pointer;",
  "  border: 1px solid transparent; border-radius: 8px;",
  "  padding: 5px 14px; font-size: 13px; line-height: 1.5;",
  "}",
  ".ss-card-discard { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); background: none; }",
  ".ss-card-discard:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-dimmed); }",
  ".ss-card-save { background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); }",
  ".ss-card-save:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }",
  ".ss-card-discard:disabled, .ss-card-save:disabled { opacity: 0.4; cursor: default; }",
  ".ss-card-discard:focus-visible, .ss-card-save:focus-visible {",
  "  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;",
  "}"
].join("\n");
function injectStyles() {
  if (typeof document === "undefined") return () => void 0;
  if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) {
    return () => void 0;
  }
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-later";
  tag.dataset.pluginCss = STYLE_ID;
  tag.textContent = COMPONENTS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}

// src/client/components/SchedButton.tsx
var import_react6 = require("react");

// src/time-utils.ts
function detectTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz?.length ? tz : "UTC";
  } catch {
    return "UTC";
  }
}
function formatRelative(epoch, now = Date.now(), locale = "zh") {
  const diff = epoch - now;
  if (locale === "en") {
    if (diff < 0) return "overdue";
    if (diff < MINUTE_MS) return "sending soon";
    const minutes2 = Math.round(diff / MINUTE_MS);
    if (minutes2 < 60) return `in ~${minutes2} min`;
    const hours2 = Math.floor(minutes2 / 60);
    const restMinutes2 = minutes2 % 60;
    if (hours2 < 24) {
      return restMinutes2 === 0 ? `in ~${hours2} h` : `in ~${hours2} h ${restMinutes2} min`;
    }
    const days2 = Math.floor(hours2 / 24);
    return `in ~${days2} days`;
  }
  if (diff < 0) return "\u5DF2\u5230\u671F";
  if (diff < MINUTE_MS) return "\u5373\u5C06\u53D1\u9001";
  const minutes = Math.round(diff / MINUTE_MS);
  if (minutes < 60) return `\u7EA6 ${minutes} \u5206\u949F\u540E`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes === 0 ? `\u7EA6 ${hours} \u5C0F\u65F6\u540E` : `\u7EA6 ${hours} \u5C0F\u65F6 ${restMinutes} \u5206\u540E`;
  }
  const days = Math.floor(hours / 24);
  return `\u7EA6 ${days} \u5929\u540E`;
}
var MINUTE_MS = 60 * 1e3;
var HOUR_MS = 60 * MINUTE_MS;
var DAY_MS = 24 * HOUR_MS;
function formatAbsolute(epoch, timeZone, locale = "zh") {
  const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    timeZone,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  return formatter.format(epoch).replace(/\s+/g, " ");
}
function formatHhmm(epoch, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB-u-ca-iso8601-nu-latn", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  return formatter.format(epoch);
}

// src/client/useSchedT.ts
var import_react = require("react");

// src/client/strings.ts
var zh = {
  /** 输入框按钮 tooltip */
  buttonSchedule: "\u5B9A\u65F6\u53D1\u9001",
  /** 面板标题 */
  panelTitle: "\u5B9A\u65F6\u63D0\u9192",
  /** 关闭面板 */
  close: "\u5173\u95ED",
  /** 快捷选项 */
  quick10m: "10\u5206\u949F\u540E",
  quick1h: "1\u5C0F\u65F6\u540E",
  quickSmart: "\u5DE5\u4F5C\u65F6\u95F4",
  quickCustom: "\u81EA\u5B9A\u4E49\u2026",
  /** 自定义输入 */
  dateLabel: "\u65E5\u671F",
  timeLabel: "\u65F6\u95F4",
  today: "\u4ECA\u5929",
  tomorrow: "\u660E\u5929",
  /** 任务列表 */
  taskListTitle: "\u5DF2\u8BBE\u5B9A",
  emptyTasks: "\u6682\u65E0\u5B9A\u65F6\u4EFB\u52A1",
  deleteTask: "\u5220\u9664\u63D0\u9192",
  /** 编辑提醒内容（dock 行内） */
  editTask: "\u7F16\u8F91\u63D0\u9192",
  editSave: "\u4FDD\u5B58",
  editCancel: "\u53D6\u6D88",
  editErrEmpty: "\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A",
  editErrFailed: "\u4FEE\u6539\u5931\u8D25\uFF1A{message}",
  editErrNotAccepted: "\u547D\u4EE4\u672A\u88AB\u53D7\u7406",
  editErrCommandFailed: "\u547D\u4EE4\u5931\u8D25",
  /** 主动插话发送：立即把提醒内容推给 agent（QueueDock「插话发送」语义） */
  steerTask: "\u63D2\u8BDD\u53D1\u9001",
  steerAlreadySent: "\u5DF2\u63D2\u8BDD",
  steerFailed: "\u63D2\u8BDD\u5931\u8D25\uFF1A{message}",
  steerUnsupportedKind: "\u5468\u671F\u63D0\u9192\u6682\u4E0D\u652F\u6301\u63D2\u8BDD",
  /** 暂停 / 恢复（仅 after；原地冻结进度条） */
  pauseTask: "\u6682\u505C\u63D0\u9192",
  resumeTask: "\u6062\u590D\u63D0\u9192",
  pausedLabel: "\u5DF2\u6682\u505C",
  pauseFailed: "\u6682\u505C\u5931\u8D25\uFF1A{message}",
  resumeFailed: "\u6062\u590D\u5931\u8D25\uFF1A{message}",
  pauseUnsupportedKind: "\u4EC5\u652F\u6301\u6682\u505C\u300C\u518D\u7B49 N \u5206\u949F\u300D\u7C7B\u63D0\u9192",
  /** dock 折叠头计数（QueueDock「N 条排队消息」样式） */
  panelCount: "{n} \u6761\u5B9A\u65F6\u63D0\u9192",
  /** 精准倒计时（dock 行 + 折叠头） */
  countdownLeft: "\u5269",
  dueAnyMoment: "\u5373\u5C06\u53D1\u9001",
  /** 状态 */
  sending: "\u6B63\u5728\u53D1\u9001\u2026",
  /** 确认按钮 */
  confirmAdd: "\u52A0\u5165 \xB7 {time} \u53D1\u9001",
  confirmAddNoTime: "\u9009\u62E9\u53D1\u9001\u65F6\u95F4",
  /** 提示 */
  promptFromDraft: "\u5C06\u4EE5\u8F93\u5165\u6846\u5185\u5BB9\u4F5C\u4E3A\u63D0\u9192\u5185\u5BB9",
  /** 错误提示 */
  errPromptEmpty: "\u8BF7\u5148\u5728\u8F93\u5165\u6846\u8F93\u5165\u5185\u5BB9",
  errPromptTooLong: "\u63D0\u9192\u5185\u5BB9\u4E0D\u80FD\u8D85\u8FC7 1000 \u5B57\u7B26",
  errTimePast: "\u8BF7\u9009\u62E9\u672A\u6765\u7684\u65F6\u95F4",
  errCreateFailed: "\u521B\u5EFA\u5931\u8D25\uFF1A{message}",
  errDeleteFailed: "\u5220\u9664\u5931\u8D25\uFF1A{message}",
  /** 客户端本地错误（hook 抛令牌，UI 按当前语言翻译） */
  errNoSession: "\u5F53\u524D\u65E0\u4F1A\u8BDD",
  errNotAcceptedStashed: "\u547D\u4EE4\u672A\u88AB\u53D7\u7406\uFF0C\u5DF2\u6682\u5B58\u672C\u5730",
  /** 侧栏会话行「定时状态」badge（docs/ui/09） */
  presenceBadgeAria: "\u6709 {n} \u6761\u5B9A\u65F6\u63D0\u9192\uFF0C\u4E0B\u6B21 {time}",
  presenceOverdueAria: "\u6709 {n} \u6761\u5B9A\u65F6\u63D0\u9192\u5DF2\u5230\u671F\uFF0C\u7B49\u5F85\u53D1\u9001",
  presenceTooltip: "\u4E0B\u6B21 {time} \xB7 {n} \u6761\u4EFB\u52A1",
  presenceOverdueTooltip: "\u5DF2\u5230\u671F \xB7 {n} \u6761\u4EFB\u52A1\uFF08\u7B49\u5F85\u4F1A\u8BDD\u7A7A\u95F2\u53D1\u9001\uFF09",
  /** 全部任务都处于暂停：没有排定的触发时刻，故不显示"下次"或"已到期"。 */
  presencePausedAria: "\u6709 {n} \u6761\u5B9A\u65F6\u63D0\u9192\u5DF2\u6682\u505C",
  presencePausedTooltip: "\u5DF2\u6682\u505C \xB7 {n} \u6761\u4EFB\u52A1",
  /** 悬浮卡片状态区追加行（与宿主 hoverStatus 同构，纯追加不改写既有状态） */
  hoverScheduleStatus: "\u6709 {n} \u6761\u5B9A\u65F6\u63D0\u9192\uFF0C\u4E0B\u6B21 {time}",
  hoverScheduleOverdue: "\u6709 {n} \u6761\u5B9A\u65F6\u63D0\u9192\u5DF2\u5230\u671F\uFF0C\u7B49\u5F85\u53D1\u9001",
  hoverSchedulePaused: "\u6709 {n} \u6761\u5B9A\u65F6\u63D0\u9192\u5DF2\u6682\u505C",
  relMinutes: "{m} \u5206\u540E",
  relHours: "{h} \u5C0F\u65F6\u540E",
  relTomorrow: "\u660E\u5929 {time}",
  relDate: "{date} {time}",
  relClock: "{time}"
};
var CLIENT_ERR = {
  NO_SESSION: "SS_ERR_NO_SESSION",
  NOT_ACCEPTED: "SS_ERR_NOT_ACCEPTED"
};
var en = {
  buttonSchedule: "Schedule send",
  panelTitle: "Scheduled reminders",
  close: "Close",
  quick10m: "In 10 minutes",
  quick1h: "In 1 hour",
  quickSmart: "Work hours",
  quickCustom: "Custom\u2026",
  dateLabel: "Date",
  timeLabel: "Time",
  today: "Today",
  tomorrow: "Tomorrow",
  taskListTitle: "Scheduled",
  emptyTasks: "No scheduled reminders",
  deleteTask: "Delete reminder",
  editTask: "Edit reminder",
  editSave: "Save",
  editCancel: "Cancel",
  editErrEmpty: "Reminder content cannot be empty",
  editErrFailed: "Edit failed: {message}",
  editErrNotAccepted: "Command was not accepted",
  editErrCommandFailed: "Command failed",
  steerTask: "Send now",
  steerAlreadySent: "Steered",
  steerFailed: "Steer failed: {message}",
  steerUnsupportedKind: "Recurring reminders can't be steered",
  pauseTask: "Pause reminder",
  resumeTask: "Resume reminder",
  pausedLabel: "Paused",
  pauseFailed: "Pause failed: {message}",
  resumeFailed: "Resume failed: {message}",
  pauseUnsupportedKind: 'Only "wait N minutes" (after) reminders can be paused',
  panelCount: "{n} scheduled reminders",
  countdownLeft: "in",
  dueAnyMoment: "Sending soon",
  sending: "Sending\u2026",
  confirmAdd: "Add \xB7 send at {time}",
  confirmAddNoTime: "Pick a send time",
  promptFromDraft: "The composer draft will be used as the reminder content",
  errPromptEmpty: "Type something in the composer first",
  errPromptTooLong: "Reminder content cannot exceed 1000 characters",
  errTimePast: "Pick a future time",
  errCreateFailed: "Create failed: {message}",
  errDeleteFailed: "Delete failed: {message}",
  errNoSession: "No active session",
  errNotAcceptedStashed: "Command was not accepted; saved locally",
  presenceBadgeAria: "{n} scheduled reminder(s), next at {time}",
  presenceOverdueAria: "{n} scheduled reminder(s) due, waiting to send",
  presenceTooltip: "Next at {time} \xB7 {n} task(s)",
  presenceOverdueTooltip: "Due \xB7 {n} task(s) (sends when the session is idle)",
  presencePausedAria: "{n} paused reminder(s)",
  presencePausedTooltip: "Paused \xB7 {n} task(s)",
  hoverScheduleStatus: "{n} scheduled reminder(s), next {time}",
  hoverScheduleOverdue: "{n} scheduled reminder(s) due, waiting to send",
  hoverSchedulePaused: "{n} paused reminder(s)",
  relMinutes: "in {m} min",
  relHours: "in {h} h",
  relTomorrow: "Tomorrow {time}",
  relDate: "{date} {time}",
  relClock: "{time}"
};
var schedDicts = { zh, en };
function dictFor(localeId) {
  return localeId === "en" ? schedDicts.en : schedDicts.zh;
}
function format(template, params) {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => key in params ? String(params[key]) : `{${key}}`
  );
}

// src/client/useSchedT.ts
var noopSubscribe = () => () => {
};
function useSchedT(locale) {
  const subscribe = (0, import_react.useCallback)(
    (onStoreChange) => locale === void 0 ? noopSubscribe() : locale.subscribe(onStoreChange),
    [locale]
  );
  const getActive = (0, import_react.useCallback)(() => locale === void 0 ? "zh" : locale.getSnapshot().active, [locale]);
  const active = (0, import_react.useSyncExternalStore)(subscribe, getActive);
  const lang = active === "en" ? "en" : "zh";
  return { lang, t: dictFor(active) };
}

// src/client/components/SchedPanel.tsx
var import_react3 = require("react");

// src/smart-window.ts
var DEFAULT_SMART_WINDOW = Object.freeze({
  workStart: "09:00",
  workEnd: "18:00",
  lunchStart: "12:00",
  lunchEnd: "14:00",
  eveningEnd: "22:00"
});
var HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isValidHhmm(value) {
  return typeof value === "string" && HHMM_RE.test(value);
}
function sanitizeSmartWindowConfig(raw) {
  const pick = (key, fallback) => isValidHhmm(raw?.[key]) ? raw[key] : fallback;
  return {
    workStart: pick("workStart", DEFAULT_SMART_WINDOW.workStart),
    workEnd: pick("workEnd", DEFAULT_SMART_WINDOW.workEnd),
    lunchStart: pick("lunchStart", DEFAULT_SMART_WINDOW.lunchStart),
    lunchEnd: pick("lunchEnd", DEFAULT_SMART_WINDOW.lunchEnd),
    eveningEnd: pick("eveningEnd", DEFAULT_SMART_WINDOW.eveningEnd)
  };
}
var SMART_MIN_DELAY_MS = 2 * 60 * 1e3;
var MINUTE_MS2 = 60 * 1e3;
var HOUR_MS2 = 60 * MINUTE_MS2;
var DAY_MS2 = 24 * HOUR_MS2;
function hhmmToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (match === null) return void 0;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return void 0;
  return hour * 60 + minute;
}
function isValidWindow(window2) {
  const order = [
    hhmmToMinutes(window2.workStart),
    hhmmToMinutes(window2.lunchStart),
    hhmmToMinutes(window2.lunchEnd),
    hhmmToMinutes(window2.workEnd),
    hhmmToMinutes(window2.eveningEnd)
  ];
  if (order.some((value) => value === void 0)) return false;
  return order[0] < order[1] && order[1] < order[2] && order[2] < order[3] && order[3] < order[4];
}
function formatterFor(timeZone) {
  return new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
}
function localFieldsOf(epoch, timeZone) {
  const formatter = formatterFor(timeZone);
  const parts = Object.fromEntries(
    formatter.formatToParts(epoch).map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
    hour: Number(parts["hour"]),
    minute: Number(parts["minute"]),
    second: Number(parts["second"])
  };
}
function offsetOf(epoch, timeZone) {
  const f = localFieldsOf(epoch, timeZone);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second, 0) - epoch;
}
function resolveWallClock(epochOnDay, timeZone, hour, minute, second = 0) {
  const base = localFieldsOf(epochOnDay, timeZone);
  const localEpoch = Date.UTC(base.year, base.month - 1, base.day, hour, minute, second, 0);
  const offsets = /* @__PURE__ */ new Set();
  for (let delta = -2; delta <= 2; delta += 1) {
    offsets.add(offsetOf(localEpoch + delta * DAY_MS2, timeZone));
  }
  const candidates = [];
  for (const offset of offsets) {
    const candidate = localEpoch - offset;
    const f = localFieldsOf(candidate, timeZone);
    if (f.year === base.year && f.month === base.month && f.day === base.day && f.hour === hour && f.minute === minute && f.second === second) {
      candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a - b);
  return candidates[0];
}
function nextMinutesAfter(now, timeZone, minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  let probe = resolveWallClock(now, timeZone, hour, minute);
  if (probe === void 0) {
    probe = resolveWallClock(now + DAY_MS2, timeZone, hour, minute);
  }
  if (probe === void 0) {
    return Date.UTC(
      localFieldsOf(now, timeZone).year,
      localFieldsOf(now, timeZone).month - 1,
      localFieldsOf(now, timeZone).day,
      hour,
      minute,
      0,
      0
    );
  }
  if (probe > now) return probe;
  const nextDay = resolveWallClock(probe + DAY_MS2, timeZone, hour, minute) ?? probe + DAY_MS2;
  return nextDay > now ? nextDay : nextDay + DAY_MS2;
}
function nextSmartTarget(now, timeZone, window2 = DEFAULT_SMART_WINDOW) {
  if (!isValidWindow(window2)) throw new TypeError("smart window configuration is invalid");
  const fields = localFieldsOf(now, timeZone);
  const minutes = fields.hour * 60 + fields.minute;
  const lunchStart = hhmmToMinutes(window2.lunchStart);
  const lunchEnd = hhmmToMinutes(window2.lunchEnd);
  if (minutes >= lunchStart && minutes < lunchEnd) {
    return now + SMART_MIN_DELAY_MS;
  }
  const workStart = hhmmToMinutes(window2.workStart);
  const eveningStart = hhmmToMinutes(window2.workEnd);
  const candidates = [
    nextMinutesAfter(now, timeZone, workStart),
    nextMinutesAfter(now, timeZone, lunchEnd),
    nextMinutesAfter(now, timeZone, eveningStart)
  ].filter((target) => target > now + SMART_MIN_DELAY_MS);
  if (candidates.length === 0) {
    const earliest = Math.min(
      nextMinutesAfter(now, timeZone, workStart),
      nextMinutesAfter(now, timeZone, lunchEnd),
      nextMinutesAfter(now, timeZone, eveningStart)
    );
    return Math.max(earliest, now + SMART_MIN_DELAY_MS);
  }
  return Math.min(...candidates);
}
function epochFromLocal(date, time, timeZone) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (dateMatch === null || timeMatch === null) return void 0;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59 || month < 1 || month > 12 || day < 1 || day > 31) {
    return void 0;
  }
  const approx = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return resolveWallClock(approx, timeZone, hour, minute, second);
}
function nextSmartAt(now, timeZone, window2 = DEFAULT_SMART_WINDOW) {
  let target;
  try {
    target = nextSmartTarget(now, timeZone, window2);
  } catch {
    return null;
  }
  let parts;
  try {
    parts = localFieldsOf(target, timeZone);
  } catch {
    return null;
  }
  const date = `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
  return {
    date,
    time,
    time_zone: timeZone,
    epoch: target
  };
}

// src/client/components/TaskList.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function scheduleStateOf(item, now) {
  return Date.parse(item.scheduled_at) <= now ? "overdue" : "scheduled";
}
function TaskList({ items, now, deliveredIds, cancellingIds, onDelete, timeZone, t, lang }) {
  if (items.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ss-empty", "data-ss-empty": "", children: t.emptyTasks });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "ss-tasks", "data-ss-tasks": "", children: items.map((item) => {
    const dotState = deliveredIds?.has(item.id) ? "delivered" : cancellingIds?.has(item.id) ? "cancelled" : scheduleStateOf(item, now);
    const isCancelled = dotState === "cancelled";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: isCancelled ? "ss-task cancelled" : "ss-task", "data-ss-task": item.id, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `ss-dot ${dotState}`, "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "ss-task-main", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "ss-task-time", children: [
          formatAbsolute(Date.parse(item.scheduled_at), timeZone, lang),
          " \xB7 ",
          formatRelative(Date.parse(item.scheduled_at), now, lang)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ss-task-prompt", children: item.prompt })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "ss-task-del",
          title: t.deleteTask,
          "aria-label": `${t.deleteTask}: ${item.prompt}`,
          onClick: (event) => {
            event.stopPropagation();
            onDelete(item.id);
          },
          children: "\u2715"
        }
      )
    ] }, item.id);
  }) });
}

// src/client/useCountdown.ts
var import_react2 = require("react");
function useNow(intervalMs = 1e3) {
  const [now, setNow] = (0, import_react2.useState)(() => Date.now());
  (0, import_react2.useEffect)(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// src/client/components/SchedPanel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function atOnDay(dayOffset, hhmm, timeZone, now) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (match === null) return null;
  const fields = localFieldsOf(now + dayOffset * 24 * 3600 * 1e3, timeZone);
  const date = `${String(fields.year).padStart(4, "0")}-${String(fields.month).padStart(2, "0")}-${String(fields.day).padStart(2, "0")}`;
  const epoch = epochFromLocal(date, `${hhmm}:00`, timeZone);
  if (epoch === void 0 || Number.isNaN(epoch)) return null;
  return { at: { date, time: `${hhmm}:00`, time_zone: timeZone }, epoch };
}
function SchedPanel({
  defaultPrompt,
  schedules,
  timeZone,
  busy,
  t,
  lang,
  onClose,
  onCreate,
  onDelete,
  bottom,
  smartWindow = DEFAULT_SMART_WINDOW,
  promptLimits
}) {
  const now = useNow(1e3);
  const [selected, setSelected] = (0, import_react3.useState)("after-600");
  const [customDate, setCustomDate] = (0, import_react3.useState)(() => {
    const f = localFieldsOf(Date.now(), timeZone);
    return `${String(f.year).padStart(4, "0")}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`;
  });
  const [customTime, setCustomTime] = (0, import_react3.useState)("18:00");
  const [error, setError] = (0, import_react3.useState)(null);
  const [cancelling, setCancelling] = (0, import_react3.useState)(/* @__PURE__ */ new Set());
  const [delivered, setDelivered] = (0, import_react3.useState)(/* @__PURE__ */ new Set());
  const deliveredTimers = (0, import_react3.useRef)([]);
  const prevIds = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    const currentIds = new Set(schedules.map((item) => item.id));
    const previous = prevIds.current;
    prevIds.current = currentIds;
    if (previous === null) return;
    const gone = [...previous].filter((id) => !currentIds.has(id) && !cancelling.has(id));
    if (gone.length === 0) return;
    setDelivered((existing) => /* @__PURE__ */ new Set([...existing, ...gone]));
    for (const id of gone) {
      const timer = window.setTimeout(() => {
        setDelivered((existing) => {
          const next = new Set(existing);
          next.delete(id);
          return next;
        });
      }, 3e3);
      deliveredTimers.current.push(timer);
    }
  }, [schedules, cancelling]);
  (0, import_react3.useEffect)(
    () => () => {
      for (const timer of deliveredTimers.current) window.clearTimeout(timer);
    },
    []
  );
  const quickOptions = (0, import_react3.useMemo)(() => {
    const options = [
      { kind: "after", seconds: 600, label: t.quick10m },
      { kind: "after", seconds: 3600, label: t.quick1h }
    ];
    const todayEvening = atOnDay(0, smartWindow.workEnd, timeZone, now);
    if (todayEvening !== null && todayEvening.epoch > now) {
      options.push({ kind: "at", ...todayEvening, label: `${t.today} ${smartWindow.workEnd}` });
    }
    const tomorrowMorning = atOnDay(1, smartWindow.workStart, timeZone, now);
    if (tomorrowMorning !== null && tomorrowMorning.epoch > now) {
      options.push({ kind: "at", ...tomorrowMorning, label: `${t.tomorrow} ${smartWindow.workStart}` });
    }
    const smart = nextSmartAt(now, timeZone, smartWindow);
    if (smart !== null) {
      options.push({
        kind: "smart",
        at: { date: smart.date, time: smart.time, time_zone: smart.time_zone },
        epoch: smart.epoch,
        label: t.quickSmart
      });
    }
    options.push({ kind: "custom", label: t.quickCustom });
    return options;
  }, [timeZone, now, t, smartWindow]);
  const target = (0, import_react3.useMemo)(() => {
    if (selected === "custom") {
      const match = /^(\d{2}):(\d{2})$/.exec(customTime);
      if (match === null) return null;
      const epoch = epochFromLocal(customDate, `${customTime}:00`, timeZone);
      if (epoch === void 0 || Number.isNaN(epoch) || epoch <= now) return null;
      return { at: { date: customDate, time: `${customTime}:00`, time_zone: timeZone }, epoch };
    }
    const option = quickOptions.find((item) => keyOf(item) === selected);
    if (option === void 0 || option.kind === "custom") return null;
    if (option.kind === "after") return { after_seconds: option.seconds, epoch: now + option.seconds * 1e3 };
    return { at: option.at, epoch: option.epoch };
  }, [selected, customDate, customTime, timeZone, now, quickOptions]);
  const targetLabel = (0, import_react3.useMemo)(() => {
    if (target === void 0 || target === null) return null;
    return `${formatAbsolute(target.epoch, timeZone, lang)} \xB7 ${formatRelative(target.epoch, now, lang)}`;
  }, [target, timeZone, now]);
  const handleConfirm = async () => {
    const text = defaultPrompt.trim();
    if (text.length === 0) {
      setError(t.errPromptEmpty);
      return;
    }
    const maxChars = promptLimits?.maxChars ?? 1e3;
    if (text.length > maxChars) {
      setError(t.errPromptTooLong);
      return;
    }
    if (target === null) {
      setError(t.errTimePast);
      return;
    }
    setError(null);
    try {
      await onCreate(
        target.at !== void 0 ? { prompt: text, at: target.at } : { prompt: text, after_seconds: target.after_seconds }
      );
      onClose();
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      const message = raw === CLIENT_ERR.NO_SESSION ? t.errNoSession : raw === CLIENT_ERR.NOT_ACCEPTED ? t.errNotAcceptedStashed : raw;
      setError(format(t.errCreateFailed, { message }));
    }
  };
  const handleDelete = (id) => {
    setCancelling((current) => new Set(current).add(id));
    try {
      onDelete(id);
    } catch (cause) {
      setError(format(t.errDeleteFailed, { message: cause instanceof Error ? cause.message : String(cause) }));
    }
    window.setTimeout(() => {
      setCancelling((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, 2500);
  };
  const promptEmpty = defaultPrompt.trim().length === 0;
  const canConfirm = !busy && !promptEmpty && target !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ss-panel", "data-ss-panel": "", role: "dialog", "aria-label": t.panelTitle, style: { bottom }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ss-panel-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ss-panel-title", children: t.panelTitle }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "ss-panel-close", "aria-label": t.close, onClick: onClose, children: "\u2715" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ss-quick-grid", role: "radiogroup", "aria-label": t.panelTitle, children: quickOptions.map((option) => {
      const key = keyOf(option);
      const active = selected === key || option.kind === "custom" && selected === "custom";
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": active,
          className: active ? "ss-quick-chip ss-active" : "ss-quick-chip",
          onClick: () => {
            setSelected(key);
            setError(null);
          },
          children: option.label
        },
        key
      );
    }) }),
    selected === "custom" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ss-custom-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "date",
          className: "ss-input",
          "aria-label": t.dateLabel,
          value: customDate,
          onChange: (event) => {
            if (event.target.value) setCustomDate(event.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "time",
          className: "ss-input",
          "aria-label": t.timeLabel,
          value: customTime,
          onChange: (event) => {
            if (event.target.value) setCustomTime(event.target.value);
          }
        }
      )
    ] }),
    target !== null && targetLabel !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ss-hint", style: { margin: "6px 0 0" }, children: targetLabel }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ss-error", role: "alert", style: { marginTop: 6 }, children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ss-tasklist-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ss-hint", children: [
      t.taskListTitle,
      schedules.length > 0 ? ` (${schedules.length})` : ""
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      TaskList,
      {
        items: schedules,
        now,
        deliveredIds: delivered,
        cancellingIds: cancelling,
        onDelete: handleDelete,
        timeZone,
        t,
        lang
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ss-footer", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        type: "button",
        className: "ss-confirm",
        disabled: !canConfirm,
        onClick: () => void handleConfirm(),
        children: busy ? t.sending : target !== null ? format(t.confirmAdd, { time: formatAbsolute(target.epoch, timeZone, lang) }) : t.confirmAddNoTime
      }
    ) }),
    promptEmpty && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ss-hint", style: { marginTop: 6 }, children: t.promptFromDraft })
  ] });
}
function keyOf(option) {
  switch (option.kind) {
    case "after":
      return `after-${option.seconds}`;
    case "at":
      return `at-${option.at.date}-${option.at.time}`;
    case "smart":
      return "smart";
    case "custom":
      return "custom";
  }
}

// src/client/hooks/useSchedules.ts
var import_react4 = require("react");

// src/client/local-store.ts
var STORAGE_KEY = "dsh-later:pending";
function readPending() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingSchedule);
  } catch {
    return [];
  }
}
function writePending(pending) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
  }
}
function appendPending(payload) {
  const pending = readPending();
  const clientSeq = pending.reduce((max, item2) => Math.max(max, item2.clientSeq), 0) + 1;
  const item = { clientSeq, createdAt: Date.now(), payload };
  writePending([...pending, item]);
  return item;
}
function removePending(clientSeq) {
  const pending = readPending().filter((item) => item.clientSeq !== clientSeq);
  writePending(pending);
}
function isPendingSchedule(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  return typeof v["clientSeq"] === "number" && typeof v["createdAt"] === "number" && typeof v["payload"] === "object" && v["payload"] !== null;
}

// src/client/hooks/useSchedules.ts
function schedulesOf(projection) {
  return projection?.schedules ?? [];
}
var createLine = (input) => {
  const body = { prompt: input.prompt, time_zone: detectTimeZone() };
  if (input.at !== void 0) body["at"] = input.at;
  if (input.after_seconds !== void 0) body["after_seconds"] = input.after_seconds;
  return `/user-schedule-create ${JSON.stringify(body)}`;
};
var deleteLine = (id) => `/user-schedule-delete ${JSON.stringify({ id })}`;
function useSchedules(inject2) {
  const { callCommand, sessionId, inputActions, input, useProjection, useInput } = inject2;
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [anchorBottom, setAnchorBottom] = (0, import_react4.useState)(80);
  const [pendingSync, setPendingSync] = (0, import_react4.useState)(() => readPending());
  const rowRef = (0, import_react4.useRef)(null);
  const now = useNow(1e3);
  const draft = input?.draft ?? (typeof useInput === "function" ? useInput((s) => s.draft) : "") ?? "";
  const projection = typeof useProjection === "function" ? useProjection("userSchedules") : void 0;
  const schedules = (0, import_react4.useMemo)(() => schedulesOf(projection), [projection]);
  const nextEpoch = (0, import_react4.useMemo)(() => {
    return schedules.map((item) => Date.parse(item.scheduled_at)).filter((value) => !Number.isNaN(value)).sort((a, b) => a - b)[0];
  }, [schedules]);
  const enabled = draft.trim().length > 0 || schedules.length > 0;
  const reposition = (0, import_react4.useCallback)(() => {
    const el = rowRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    setAnchorBottom(Math.max(12, window.innerHeight - rect.top + 10));
  }, []);
  const syncedPrompts = (0, import_react4.useMemo)(() => {
    return new Set(schedules.map((item) => item.prompt));
  }, [schedules]);
  (0, import_react4.useEffect)(() => {
    if (pendingSync.length === 0) return;
    const remaining = pendingSync.filter((item) => !syncedPrompts.has(item.payload.prompt));
    if (remaining.length !== pendingSync.length) {
      setPendingSync(remaining);
      writePendingLocal(remaining);
    }
  }, [syncedPrompts, pendingSync]);
  (0, import_react4.useEffect)(() => {
    if (pendingSync.length === 0 || !sessionId) return;
    let cancelled = false;
    const syncAll = async () => {
      const items = [...pendingSync];
      for (const item of items) {
        if (cancelled) return;
        try {
          const accepted = await callCommand(sessionId, createLine(item.payload));
          if (accepted.matched && !cancelled) {
            removePending(item.clientSeq);
            setPendingSync((prev) => prev.filter((p) => p.clientSeq !== item.clientSeq));
          }
        } catch {
          return;
        }
      }
    };
    void syncAll();
    const onOnline = () => {
      if (!cancelled) void syncAll();
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [pendingSync, sessionId, callCommand]);
  const handleCreate = (0, import_react4.useCallback)(async (inputPayload) => {
    if (!sessionId) {
      throw new Error(CLIENT_ERR.NO_SESSION);
    }
    setBusy(true);
    try {
      const accepted = await callCommand(sessionId, createLine(inputPayload));
      if (!accepted.matched) {
        appendPending(inputPayload);
        setPendingSync((prev) => [...prev, { clientSeq: Date.now(), createdAt: Date.now(), payload: inputPayload }]);
        throw new Error(CLIENT_ERR.NOT_ACCEPTED);
      }
    } finally {
      setBusy(false);
    }
  }, [sessionId, callCommand]);
  const handleDelete = (0, import_react4.useCallback)(async (id) => {
    if (!sessionId) return;
    await callCommand(sessionId, deleteLine(id));
  }, [sessionId, callCommand]);
  const handleCancelAll = (0, import_react4.useCallback)(async () => {
    if (!sessionId) return;
    await Promise.all(schedules.map((item) => callCommand(sessionId, deleteLine(item.id))));
  }, [sessionId, schedules, callCommand]);
  const handleClearDraft = (0, import_react4.useCallback)(() => {
    inputActions?.setDraft("");
  }, [inputActions]);
  return {
    draft,
    schedules,
    nextEpoch,
    enabled,
    busy,
    anchorBottom,
    reposition,
    handleCreate,
    handleDelete,
    handleCancelAll,
    handleClearDraft,
    rowRef
  };
}
function writePendingLocal(pending) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("dsh-later:pending", JSON.stringify(pending));
    }
  } catch {
  }
}

// src/client/hooks/useSchedulerSettings.ts
var import_react5 = require("react");
var CLIENT_DEFAULT_MAX_PROMPT_CHARS = 1e3;
var FALLBACK_PROMPT = {
  allowLong: false,
  maxChars: CLIENT_DEFAULT_MAX_PROMPT_CHARS
};
var FALLBACK = {
  ready: false,
  showButton: true,
  smartWindow: sanitizeSmartWindowConfig(void 0),
  promptLimits: FALLBACK_PROMPT
};
function resolvePromptLimitsFromSnapshot(snap) {
  if (snap.status !== "ready") return FALLBACK_PROMPT;
  const value = snap.value ?? {};
  const allowLong = value["allowLongPrompts"] === true;
  const raw = value["maxPromptChars"];
  const valid = typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && Math.floor(raw) === raw;
  if (allowLong && valid) return { allowLong: true, maxChars: raw };
  return FALLBACK_PROMPT;
}
function resolveFromSnapshot(snap) {
  if (snap.status !== "ready") {
    return {
      ready: false,
      showButton: true,
      smartWindow: FALLBACK.smartWindow,
      promptLimits: FALLBACK_PROMPT
    };
  }
  const value = snap.value ?? {};
  return {
    ready: true,
    // 仅显式 false 隐藏；缺失/非法一律回退显示（与 schema 默认 true 同源）。
    showButton: value["showButton"] !== false,
    smartWindow: sanitizeSmartWindowConfig(
      value
    ),
    promptLimits: resolvePromptLimitsFromSnapshot(snap)
  };
}
var NOOP_SUBSCRIBE = () => () => void 0;
var EMPTY_SNAPSHOT = { status: "unavailable" };
function useSchedulerSettings(scope) {
  const getSnapshot = (0, import_react5.useCallback)(
    () => scope === void 0 ? EMPTY_SNAPSHOT : scope.getSnapshot(),
    [scope]
  );
  const subscribe = (0, import_react5.useCallback)(
    (onStoreChange) => scope === void 0 ? NOOP_SUBSCRIBE() : scope.subscribe(onStoreChange),
    [scope]
  );
  const raw = (0, import_react5.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
  return (0, import_react5.useMemo)(() => resolveFromSnapshot(raw), [raw]);
}

// src/client/components/SchedButton.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function SchedButton(props) {
  const { callCommand, sessionId, inputActions, input, useProjection, useInput, locale, schedulerScope } = props;
  const { lang, t } = useSchedT(locale);
  const { smartWindow, promptLimits, showButton } = useSchedulerSettings(schedulerScope);
  const [open, setOpen] = (0, import_react6.useState)(false);
  const {
    draft,
    schedules,
    enabled,
    busy,
    anchorBottom,
    reposition,
    handleCreate,
    handleDelete,
    rowRef
  } = useSchedules({
    callCommand,
    sessionId,
    inputActions,
    input,
    useProjection,
    useInput
  });
  (0, import_react6.useEffect)(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, reposition]);
  if (!showButton) return null;
  const handleCreateWithErrorBoundary = async (inputPayload) => {
    try {
      await handleCreate(inputPayload);
    } catch {
      setOpen(false);
      throw new Error(t.editErrNotAccepted);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { ref: rowRef, className: "ss-sched-row", "data-ss-sched-row": "", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        className: open ? "ss-sched-btn ss-active" : "ss-sched-btn",
        title: t.buttonSchedule,
        "aria-label": t.buttonSchedule,
        "aria-expanded": open,
        disabled: !enabled,
        onClick: () => setOpen((value) => !value),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("polyline", { points: "12 6 12 12 16 14" })
        ] })
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ss-backdrop", onClick: () => setOpen(false), "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        SchedPanel,
        {
          defaultPrompt: draft,
          schedules,
          timeZone: detectTimeZone(),
          busy,
          t,
          lang,
          onClose: () => setOpen(false),
          onCreate: handleCreateWithErrorBoundary,
          onDelete: (id) => void handleDelete(id),
          bottom: anchorBottom,
          smartWindow,
          promptLimits
        }
      )
    ] })
  ] });
}

// src/client/components/ScheduleDock.tsx
var import_react7 = require("react");

// src/bar-geometry.ts
var BAR_UNIT_MS = 36e5;
function barWindow(item, end, now, firstSeen) {
  let start;
  if (item.kind === "after") {
    const windowSec = item.window_seconds ?? item.after_seconds;
    if (windowSec !== void 0) {
      start = end - windowSec * 1e3;
    } else if (item.created_at !== void 0) {
      const parsed = Date.parse(item.created_at);
      start = Number.isNaN(parsed) ? firstSeen.get(item.id) ?? now : parsed;
    } else {
      start = firstSeen.get(item.id) ?? now;
    }
  } else if (item.kind === "every" && item.every_seconds !== void 0) {
    start = end - item.every_seconds * 1e3;
  } else if (item.created_at !== void 0) {
    const parsed = Date.parse(item.created_at);
    start = Number.isNaN(parsed) ? firstSeen.get(item.id) ?? now : parsed;
  } else {
    start = firstSeen.get(item.id) ?? now;
  }
  return { start, totalMs: Math.max(1e3, end - start) };
}
function ratioAt(item, at, firstSeen) {
  const end = Date.parse(item.scheduled_at);
  const { start, totalMs } = barWindow(item, end, at, firstSeen);
  const elapsedMs = Math.min(Math.max(at - start, 0), totalMs);
  return {
    totalRatio: elapsedMs / totalMs,
    count: Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS))
  };
}
function barSegments(item, now, firstSeen) {
  return ratioAt(item, now, firstSeen);
}
function frozenBarSegments(item, frozenLeftMs, firstSeen, renderedAt) {
  const windowSec = item.window_seconds ?? item.after_seconds;
  if (windowSec === void 0 || windowSec <= 0) {
    const end = Date.parse(item.scheduled_at);
    const pausedAt2 = Date.parse(item.paused_at ?? "");
    const exact = Number.isNaN(pausedAt2) ? end - Math.floor(frozenLeftMs / 1e3) * 1e3 : pausedAt2;
    return ratioAt(item, Number.isNaN(exact) ? end : exact, firstSeen);
  }
  const totalMs = Math.max(1e3, windowSec * 1e3);
  let leftMs = Math.min(Math.max(frozenLeftMs, 0), totalMs);
  const pausedAt = Date.parse(item.paused_at ?? "");
  if (renderedAt !== void 0 && !Number.isNaN(pausedAt) && pausedAt > renderedAt) {
    leftMs = Math.min(leftMs + (pausedAt - renderedAt), totalMs);
  }
  const elapsedMs = Math.min(Math.max(totalMs - leftMs, 0), totalMs);
  return {
    totalRatio: elapsedMs / totalMs,
    count: Math.max(1, Math.ceil(totalMs / BAR_UNIT_MS))
  };
}
function planBarAnimation(totalMs, elapsedMs) {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return void 0;
  const raw = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const clamped = Math.min(Math.max(raw, 0), totalMs);
  const elapsed = clamped === 0 ? 0 : clamped;
  if (elapsed >= totalMs) return void 0;
  return {
    durationMs: totalMs,
    // -0 会在 CSS 里序列化成难看的 "-0ms"，故显式归零
    delayMs: elapsed === 0 ? 0 : -elapsed
  };
}

// src/client/components/ScheduleDock.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function formatCountdown(ms) {
  const total = Math.max(0, Math.round(ms / 1e3));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}
function planBarAnimationFor(item, now, firstSeen) {
  const end = Date.parse(item.scheduled_at);
  if (!Number.isFinite(end)) return void 0;
  const { start, totalMs } = barWindow(item, end, now, firstSeen);
  return planBarAnimation(totalMs, now - start);
}
var deleteLine2 = (id) => `/user-schedule-delete ${JSON.stringify({ id })}`;
var editLine = (id, prompt) => `/user-schedule-edit ${JSON.stringify({ id, prompt })}`;
var steerLine = (id) => `/user-schedule-steer-now ${JSON.stringify({ id })}`;
var pauseLine = (id) => `/user-schedule-pause ${JSON.stringify({ id })}`;
var resumeLine = (uid) => `/user-schedule-resume ${JSON.stringify({ uid })}`;
function canPause(item, now) {
  if (item.status === "paused") return false;
  if (item.kind !== "after") return false;
  const epoch = Date.parse(item.scheduled_at);
  return Number.isFinite(epoch) && epoch > now;
}
function ScheduleDock({ callCommand, sessionId, useProjection, locale }) {
  const now = useNow(1e3);
  const { t } = useSchedT(locale);
  const projection = typeof useProjection === "function" ? useProjection("userSchedules") : void 0;
  const [dismissedPaused, setDismissedPaused] = (0, import_react7.useState)(/* @__PURE__ */ new Set());
  (0, import_react7.useEffect)(() => {
    const live = projection?.schedules;
    if (live === void 0) return;
    setDismissedPaused((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const nextSet = new Set(current);
      for (const item of live) {
        if (item.status !== "paused" && nextSet.delete(item.id)) changed = true;
      }
      return changed ? nextSet : current;
    });
  }, [projection]);
  const [promptOverrides, setPromptOverrides] = (0, import_react7.useState)(/* @__PURE__ */ new Map());
  (0, import_react7.useEffect)(() => {
    const live = projection?.schedules;
    if (live === void 0 || promptOverrides.size === 0) return;
    setPromptOverrides((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const nextMap = new Map(current);
      for (const [id, text] of current) {
        const item = live.find((s) => s.id === id);
        if (item === void 0 || item.prompt === text) {
          nextMap.delete(id);
          changed = true;
        }
      }
      return changed ? nextMap : current;
    });
  }, [projection, promptOverrides]);
  const schedules = (0, import_react7.useMemo)(
    () => (projection?.schedules ?? []).filter((item) => !(item.status === "paused" && dismissedPaused.has(item.id))).map((item) => {
      const override = promptOverrides.get(item.id);
      return override === void 0 ? item : { ...item, prompt: override };
    }).sort(
      (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
    ),
    [projection, dismissedPaused, promptOverrides]
  );
  const [collapsed, setCollapsed] = (0, import_react7.useState)(true);
  const [cancelling, setCancelling] = (0, import_react7.useState)(/* @__PURE__ */ new Set());
  const [editingId, setEditingId] = (0, import_react7.useState)(null);
  const [editingText, setEditingText] = (0, import_react7.useState)("");
  const [editErr, setEditErr] = (0, import_react7.useState)(null);
  const [saving, setSaving] = (0, import_react7.useState)(false);
  const [steering, setSteering] = (0, import_react7.useState)(/* @__PURE__ */ new Set());
  const [steerDone, setSteerDone] = (0, import_react7.useState)(/* @__PURE__ */ new Set());
  const [steerErr, setSteerErr] = (0, import_react7.useState)(/* @__PURE__ */ new Map());
  const [pausing, setPausing] = (0, import_react7.useState)(/* @__PURE__ */ new Set());
  const [resuming, setResuming] = (0, import_react7.useState)(/* @__PURE__ */ new Set());
  const [pauseErr, setPauseErr] = (0, import_react7.useState)(/* @__PURE__ */ new Map());
  const firstSeenRef = (0, import_react7.useRef)(/* @__PURE__ */ new Map());
  const lastActiveAtRef = (0, import_react7.useRef)(/* @__PURE__ */ new Map());
  const wallClock = Date.now();
  {
    const next2 = new Map(lastActiveAtRef.current);
    let changed = false;
    for (const item of schedules) {
      if (item.status === "paused") continue;
      const prev = next2.get(item.id);
      if (prev === void 0 || wallClock > prev) {
        next2.set(item.id, wallClock);
        changed = true;
      }
    }
    for (const id of [...next2.keys()]) {
      if (!schedules.some((item) => item.id === id)) {
        next2.delete(id);
        changed = true;
      }
    }
    if (changed) lastActiveAtRef.current = next2;
  }
  const byId = (0, import_react7.useMemo)(() => new Map(schedules.map((item) => [item.id, item])), [schedules]);
  (0, import_react7.useEffect)(() => {
    let changed = false;
    const next2 = new Map(firstSeenRef.current);
    for (const [id] of byId) {
      if (!next2.has(id)) {
        next2.set(id, Date.now());
        changed = true;
      }
    }
    for (const id of [...next2.keys()]) {
      if (!byId.has(id)) {
        next2.delete(id);
        changed = true;
      }
    }
    if (changed) firstSeenRef.current = next2;
  }, [byId]);
  (0, import_react7.useEffect)(() => {
    if (schedules.length <= 1) setCollapsed(true);
  }, [schedules.length]);
  if (schedules.length === 0 || sessionId === void 0) return null;
  const next = schedules[0];
  if (next === void 0) return null;
  const expanded = schedules.length === 1 || !collapsed;
  const handleCancel = (id, status) => {
    setCancelling((current) => new Set(current).add(id));
    const restore = () => {
      setDismissedPaused((current) => {
        if (!current.has(id)) return current;
        const nextSet = new Set(current);
        nextSet.delete(id);
        return nextSet;
      });
    };
    if (status === "paused") {
      setDismissedPaused((current) => new Set(current).add(id));
    }
    void callCommand(sessionId, deleteLine2(id)).then((outcome) => {
      if (!outcome.matched) restore();
    }).catch(restore).finally(() => {
      window.setTimeout(() => {
        setCancelling((current) => {
          const nextSet = new Set(current);
          nextSet.delete(id);
          return nextSet;
        });
      }, 2500);
    });
  };
  const handleSteer = (item) => {
    const id = item.id;
    const wasPaused = item.status === "paused";
    setSteering((current) => new Set(current).add(id));
    setSteerErr((current) => {
      const next2 = new Map(current);
      next2.delete(id);
      return next2;
    });
    void callCommand(sessionId, steerLine(id)).then((outcome) => {
      if (outcome.matched) {
        setSteerDone((current) => new Set(current).add(id));
        if (wasPaused) {
          setDismissedPaused((current) => new Set(current).add(id));
        }
      } else {
        setSteerErr((current) => new Map(current).set(id, t.editErrNotAccepted));
      }
    }).catch(() => {
      setSteerErr((current) => new Map(current).set(id, t.editErrCommandFailed));
    }).finally(() => {
      setSteering((current) => {
        const next2 = new Set(current);
        next2.delete(id);
        return next2;
      });
    });
  };
  const handlePause = (item) => {
    const id = item.id;
    if (!canPause(item, now)) return;
    setPausing((current) => new Set(current).add(id));
    setPauseErr((current) => {
      const next2 = new Map(current);
      next2.delete(id);
      return next2;
    });
    void callCommand(sessionId, pauseLine(id)).then((outcome) => {
      if (!outcome.matched) {
        setPauseErr((current) => new Map(current).set(id, t.editErrNotAccepted));
      }
    }).catch(() => {
      setPauseErr((current) => new Map(current).set(id, t.editErrCommandFailed));
    }).finally(() => {
      setPausing((current) => {
        const next2 = new Set(current);
        next2.delete(id);
        return next2;
      });
    });
  };
  const handleResume = (item) => {
    const uid = item.id;
    setResuming((current) => new Set(current).add(uid));
    setPauseErr((current) => {
      const next2 = new Map(current);
      next2.delete(uid);
      return next2;
    });
    void callCommand(sessionId, resumeLine(uid)).then((outcome) => {
      if (!outcome.matched) {
        setPauseErr((current) => new Map(current).set(uid, t.editErrNotAccepted));
      }
    }).catch(() => {
      setPauseErr((current) => new Map(current).set(uid, t.editErrCommandFailed));
    }).finally(() => {
      setResuming((current) => {
        const next2 = new Set(current);
        next2.delete(uid);
        return next2;
      });
    });
  };
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.prompt);
    setEditErr(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditErr(null);
    setSaving(false);
  };
  const submitEdit = (id) => {
    const trimmed = editingText.trim();
    if (trimmed.length === 0) {
      setEditErr(t.editErrEmpty);
      return;
    }
    setSaving(true);
    setEditErr(null);
    void callCommand(sessionId, editLine(id, trimmed)).then((outcome) => {
      if (!outcome.matched) {
        setEditErr(format(t.editErrFailed, { message: t.editErrNotAccepted }));
        return;
      }
      setPromptOverrides((current) => new Map(current).set(id, trimmed));
      cancelEdit();
    }).catch(() => {
      setEditErr(format(t.editErrFailed, { message: t.editErrCommandFailed }));
    }).finally(() => setSaving(false));
  };
  const renderRow = (item) => {
    const epoch = Date.parse(item.scheduled_at);
    const state = epoch <= now ? "overdue" : "scheduled";
    if (editingId === item.id) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { className: "ss-dock-row ss-editing", "data-ss-dock-row": item.id, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            className: "ss-dock-edit-input",
            value: editingText,
            maxLength: 1e3,
            autoFocus: true,
            disabled: saving,
            onChange: (event) => setEditingText(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") submitEdit(item.id);
              else if (event.key === "Escape") cancelEdit();
              event.stopPropagation();
            },
            "aria-label": `${t.editTask}: ${item.prompt}`
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: "ss-dock-row-save",
            disabled: saving || editingText.trim().length === 0,
            onClick: () => submitEdit(item.id),
            children: saving ? "\u2026" : t.editSave
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "ss-dock-action", onClick: cancelEdit, "aria-label": t.editCancel, children: "\u2715" }),
        editErr !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ss-dock-edit-err", children: editErr })
      ] }, item.id);
    }
    const isPaused = item.status === "paused";
    const frozenLeft = isPaused ? (item.remaining_seconds ?? 0) * 1e3 : epoch - now;
    const countdownText = isPaused ? t.pausedLabel : state === "overdue" ? t.dueAnyMoment : `${t.countdownLeft} ${formatCountdown(Math.max(0, frozenLeft))}`;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "li",
      {
        className: `ss-dock-row${isPaused ? " ss-paused" : ""}`,
        "data-ss-dock-row": item.id,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ss-dock-preview", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ss-dock-row-line", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ss-dock-row-time", children: formatHhmm(epoch, detectTimeZone()) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `ss-dock-row-countdown${!isPaused && state === "overdue" ? " ss-due" : ""}${isPaused ? " ss-paused-label" : ""}`, children: countdownText }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ss-dock-row-prompt", title: item.prompt, children: item.prompt })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MultiBar, { item, now: wallClock, firstSeen: firstSeenRef.current, t, frozen: isPaused, frozenLeftMs: frozenLeft, renderedAt: lastActiveAtRef.current.get(item.id) ?? wallClock }),
            (steerErr.get(item.id) ?? pauseErr.get(item.id)) !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ss-dock-steer-err", children: steerErr.get(item.id) ?? pauseErr.get(item.id) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ss-dock-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: "ss-dock-action",
                title: t.editTask,
                "aria-label": t.editTask,
                onClick: () => startEdit(item),
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueueEditIcon, {})
              }
            ),
            isPaused ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: `ss-dock-action ss-paused-active${resuming.has(item.id) ? " ss-pending" : ""}`,
                title: t.resumeTask,
                "aria-label": t.resumeTask,
                disabled: resuming.has(item.id),
                onClick: () => handleResume(item),
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueueResumeIcon, {})
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: `ss-dock-action${pausing.has(item.id) ? " ss-pending" : ""}`,
                title: canPause(item, now) ? t.pauseTask : t.pauseUnsupportedKind,
                "aria-label": canPause(item, now) ? t.pauseTask : t.pauseUnsupportedKind,
                disabled: !canPause(item, now) || pausing.has(item.id),
                onClick: () => handlePause(item),
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueuePauseIcon, {})
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: "ss-dock-action",
                title: t.deleteTask,
                "aria-label": t.deleteTask,
                onClick: () => handleCancel(item.id, isPaused ? "paused" : "active"),
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueueDeleteIcon, {})
              }
            ),
            item.kind !== "every" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: `ss-dock-action ss-dock-action-steer${steering.has(item.id) ? " ss-pending" : ""}${steerDone.has(item.id) ? " ss-done" : ""}`,
                title: steerDone.has(item.id) ? t.steerAlreadySent : t.steerTask,
                "aria-label": steerDone.has(item.id) ? t.steerAlreadySent : t.steerTask,
                disabled: steering.has(item.id) || steerDone.has(item.id),
                onClick: () => handleSteer(item),
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueueSendIcon, {})
              }
            )
          ] })
        ]
      },
      item.id
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ss-dock-root", "data-ss-dock": "", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ss-dock-body", children: [
    schedules.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "button",
      {
        type: "button",
        className: "ss-dock-header",
        "aria-expanded": !collapsed,
        onClick: () => setCollapsed((value) => !value),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ss-dock-lead", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueueClockIcon, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ss-dock-count", children: format(t.panelCount, { n: schedules.length }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: expanded ? "ss-dock-chevron ss-open" : "ss-dock-chevron", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QueueChevronIcon, {}) })
        ]
      }
    ),
    expanded && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "ss-dock-list", children: schedules.map(renderRow) })
  ] }) });
}
function MultiBar({
  item,
  now,
  firstSeen,
  t,
  frozen = false,
  frozenLeftMs,
  renderedAt
}) {
  const frozenSeg = frozen ? frozenBarSegments(item, frozenLeftMs ?? 0, firstSeen, renderedAt) : void 0;
  const activeSeg = frozen ? void 0 : barSegments(item, now, firstSeen);
  const { totalRatio, count } = frozenSeg ?? activeSeg ?? { totalRatio: 0, count: 1 };
  const anim = frozen || prefersReducedMotion() ? void 0 : planBarAnimationFor(item, now, firstSeen);
  const fillStyle = anim === void 0 ? { width: `${totalRatio * 100}%` } : {
    // duration = 完整窗口、delay = -已过去 → 一上屏就落在绝对相位。
    // 负 delay 是**重挂载后不归零**的关键（详见 bar-geometry 注释）。
    animationName: "ss-dock-bar-progress",
    animationDuration: `${anim.durationMs}ms`,
    animationDelay: `${anim.delayMs}ms`,
    animationTimingFunction: "linear",
    animationFillMode: "forwards",
    animationIterationCount: 1
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      className: `ss-dock-bars${count > 4 ? " ss-dock-bars-compact" : ""}`,
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": Math.round(totalRatio * 100),
      "aria-label": t.panelTitle,
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ss-dock-bar", children: [
        count > 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            className: "ss-dock-bar-divider",
            style: {
              backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc((100% - 1px) / ${count}), var(--ss-bar-divider, rgba(0,0,0,0.45)) calc((100% - 1px) / ${count}), var(--ss-bar-divider, rgba(0,0,0,0.45)) calc(100% / ${count}))`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ss-dock-bar-fill", style: fillStyle })
      ] })
    }
  );
}
function QueueClockIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M7.00049 0.199829C3.24488 0.199829 0.199952 3.24408 0.199707 6.99963C0.199707 8.0414 0.434087 9.03061 0.854004 9.91467L1.11279 10.4576L2.19775 9.94202L1.94092 9.39905L1.81787 9.12268C1.5498 8.46885 1.40186 7.75171 1.40186 6.99963C1.4021 3.90808 3.90888 1.40198 7.00049 1.40198C10.0919 1.40219 12.5979 3.90821 12.5981 6.99963C12.5981 10.0913 10.0921 12.5981 7.00049 12.5983C6.36734 12.5983 5.90348 12.5535 5.49268 12.4401C5.08803 12.3283 4.7041 12.1414 4.24463 11.8209C3.57111 11.3511 2.60588 11.1855 1.81006 11.6881L1.79736 11.6959L1.78467 11.7047L1.25537 12.0778L1.65381 13.2672L2.46045 12.6989C2.75029 12.5214 3.18004 12.5442 3.55615 12.8063C4.10063 13.1861 4.60863 13.4423 5.17334 13.5983C5.73194 13.7525 6.31665 13.8004 7.00049 13.8004C10.7561 13.8002 13.8003 10.7553 13.8003 6.99963C13.8 3.24421 10.7559 0.200041 7.00049 0.199829ZM3.81201 7.47327V8.67542H7.11572V7.47327H3.81201ZM3.81201 6.34924H10.2173V5.14709H3.81201V6.34924Z", fill: "currentColor" }) });
}
function QueueChevronIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z", fill: "currentColor" }) });
}
function QueueEditIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M9.94076 1.34942C10.7047 0.90231 11.6503 0.902415 12.4143 1.34942C12.7061 1.52015 12.9688 1.79118 13.3104 2.13284C13.6521 2.47448 13.9231 2.73721 14.0939 3.02894C14.5408 3.79294 14.5409 4.73856 14.0939 5.50251C13.9231 5.79415 13.652 6.05704 13.3104 6.39861L6.65932 13.0497C6.28068 13.4284 6.00695 13.7108 5.66543 13.9097C5.32391 14.1085 4.94315 14.2074 4.42705 14.3498L3.24394 14.6761C2.77527 14.8054 2.34538 14.9262 2.00131 14.9684C1.65196 15.0112 1.17964 15.0013 0.810764 14.6325C0.441921 14.2637 0.432107 13.7913 0.47486 13.442C0.517035 13.0979 0.6379 12.668 0.767181 12.1993L1.09352 11.0162C1.23588 10.5001 1.33481 10.1193 1.5336 9.77784C1.7325 9.43632 2.0149 9.1626 2.39355 8.78395L9.04466 2.13284C9.38625 1.79126 9.64911 1.52016 9.94076 1.34942ZM15.5427 14.8398H7.55223L8.96707 13.425H15.5427V14.8398ZM3.39382 9.78422C2.965 10.213 2.84244 10.3436 2.75709 10.49C2.67183 10.6366 2.61862 10.8079 2.45733 11.3925L2.13099 12.5756C2.00183 13.0439 1.92194 13.3419 1.88863 13.5536C2.10041 13.5204 2.39872 13.4416 2.86764 13.3123L4.05075 12.9859C4.63544 12.8246 4.80669 12.7715 4.95323 12.6862C5.09968 12.6008 5.23022 12.4783 5.65905 12.0494L10.721 6.98644L8.45577 4.72121L3.39382 9.78422ZM11.7 2.57079C11.3774 2.38198 10.9777 2.38198 10.6551 2.57079C10.5602 2.62647 10.4487 2.72931 10.0449 3.13311L9.45604 3.72094L11.7213 5.98617L12.3102 5.39833C12.7139 4.99457 12.8168 4.88307 12.8725 4.78818C13.0613 4.46561 13.0612 4.06585 12.8725 3.74326C12.8169 3.64827 12.7146 3.53752 12.3102 3.13311C11.9057 2.72863 11.795 2.6264 11.7 2.57079Z", fill: "currentColor" }) });
}
function QueueDeleteIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z", fill: "currentColor" }) });
}
function QueueSendIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M7.24707 1.01771C7.52897 1.07653 7.77619 1.19694 8.00391 1.38001C8.19202 1.53136 8.39884 1.73784 8.61914 1.95814L12.6396 5.9806L11.6299 6.99134L7.71484 3.0763V13.0001H6.28516V3.0763L2.36914 6.99134L1.35938 5.9806L5.38086 1.95814C5.60116 1.73784 5.80798 1.53136 5.99609 1.38001C6.19476 1.22027 6.4385 1.06739 6.75195 1.01771C6.91296 0.992304 7.07471 0.997504 7.24707 1.01771Z", fill: "currentColor" }) });
}
function QueuePauseIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "3.6", y: "2.6", width: "3.2", height: "10.8", rx: "1.1", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "9.2", y: "2.6", width: "3.2", height: "10.8", rx: "1.1", fill: "currentColor" })
  ] });
}
function QueueResumeIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4.4 2.9c0-.6.66-1 1.18-.68l7.1 4.1c.52.3.52 1.06 0 1.36l-7.1 4.1A.8.8 0 0 1 4.4 11.1V2.9Z", fill: "currentColor" }) });
}

// src/client/components/SchedulerSettingsCard.tsx
var import_react8 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var FIELDS = [
  { kind: "boolean", key: "showButton", labelKey: "showButtonLabel", hintKey: "showButtonHint", defaultValue: true },
  { kind: "number", key: "maxSchedules", labelKey: "maxSchedulesLabel", hintKey: "maxSchedulesHint", defaultValue: 100 },
  { kind: "time", key: "workStart", labelKey: "workStartLabel", hintKey: "smartWindowHint" },
  { kind: "time", key: "workEnd", labelKey: "workEndLabel" },
  { kind: "time", key: "lunchStart", labelKey: "lunchStartLabel" },
  { kind: "time", key: "lunchEnd", labelKey: "lunchEndLabel" },
  { kind: "time", key: "eveningEnd", labelKey: "eveningEndLabel" }
];
function ChevronDown({ className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", className, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M3.5 5.25 7 8.75l3.5-3.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
function SchedulerSettingsCard({ scope, t }) {
  const [snapshot, setSnapshot] = (0, import_react8.useState)(() => scope.getSnapshot());
  const [pending, setPending] = (0, import_react8.useState)({});
  const [saving, setSaving] = (0, import_react8.useState)(false);
  const [failed, setFailed] = (0, import_react8.useState)(false);
  const [open, setOpen] = (0, import_react8.useState)(false);
  (0, import_react8.useEffect)(() => {
    const initial = scope.getSnapshot();
    setSnapshot(initial);
    setPending({});
    if (initial.status === "ready") setFailed(false);
  }, [scope]);
  (0, import_react8.useEffect)(() => {
    return scope.subscribe(() => {
      const snap = scope.getSnapshot();
      setSnapshot(snap);
      if (snap.status === "ready") {
        setFailed(false);
      }
    });
  }, [scope]);
  if (snapshot.status === "unavailable") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_jsx_runtime5.Fragment, {});
  if (snapshot.status !== "ready") {
    if (snapshot.status === "loading") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ss-hint", children: t("loading") });
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ss-hint", children: t("unavailable") });
  }
  const value = snapshot.value ?? {};
  const base = snapshot.base ?? {};
  const user = snapshot.user;
  const writable = snapshot.writable === true;
  const isUserOverridden = (key) => user !== void 0 && typeof user === "object" && Object.prototype.hasOwnProperty.call(user, key);
  const displayValue = (field) => {
    const p = pending[field.key];
    if (p !== void 0) return p.value;
    if (field.kind === "number") {
      const v2 = value[field.key];
      return v2 === void 0 ? "" : String(v2);
    }
    if (field.kind === "boolean") {
      const v2 = value[field.key];
      return v2 === false ? "false" : "true";
    }
    const v = value[field.key];
    return v ?? "";
  };
  const baselineValue = (field) => {
    if (field.kind === "number") {
      const v2 = base[field.key];
      return String(v2 ?? field.defaultValue);
    }
    if (field.kind === "boolean") {
      const v2 = base[field.key];
      return v2 === false ? "false" : "true";
    }
    const v = base[field.key];
    return v ?? "";
  };
  const dirty = Object.keys(pending).length > 0 && Object.values(pending).some((p) => p !== void 0);
  const validate = (field, raw) => {
    if (field.kind === "number") {
      if (raw.trim().length === 0) return t("invalidLabel");
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 1 || !Number.isInteger(num)) return t("invalidLabel");
      return null;
    }
    if (field.kind === "boolean") return null;
    if (raw.trim().length === 0) return null;
    if (!isValidHhmm(raw)) return t("invalidTimeLabel");
    return null;
  };
  const setFieldPending = (key, value2, reset) => {
    setPending((current) => ({ ...current, [key]: { value: value2, reset } }));
  };
  const handleFieldEdit = (field, raw) => {
    setFieldPending(field.key, raw, false);
    setFailed(false);
  };
  const handleResetField = (field) => {
    setFieldPending(field.key, baselineValue(field), true);
    setFailed(false);
  };
  const handleDiscard = (0, import_react8.useCallback)(() => {
    setPending({});
    setFailed(false);
  }, []);
  const handleSave = (0, import_react8.useCallback)(async () => {
    if (!dirty || saving || !writable) return;
    setSaving(true);
    setFailed(false);
    try {
      for (const [key, p] of Object.entries(pending)) {
        if (p === void 0) continue;
        if (p.reset) {
          await scope.unset(key);
          continue;
        }
        if (p.value.trim().length === 0) {
          await scope.unset(key);
          continue;
        }
        const field = FIELDS.find((entry) => entry.key === key);
        const coerced = field?.kind === "number" ? Number(p.value) : field?.kind === "boolean" ? p.value === "true" : p.value;
        await scope.set(key, coerced);
      }
      setPending({});
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [scope, pending, dirty, saving, writable]);
  const invalidField = (field) => {
    const p = pending[field.key];
    if (p === void 0) return null;
    return validate(field, p.value);
  };
  const anyInvalid = FIELDS.some((field) => invalidField(field) !== null);
  const saveDisabled = !dirty || saving || !writable || anyInvalid;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { className: open ? "ss-card ss-cardOpen" : "ss-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        className: "ss-card-header",
        "aria-expanded": open,
        "aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
        onClick: () => setOpen(!open),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "ss-card-headText", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ss-card-name", children: t("title") }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ss-card-description", children: t("description") })
          ] }),
          dirty && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ss-card-pending", children: t("pendingBadge") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ChevronDown, { className: open ? "ss-card-chevron ss-card-chevronOpen" : "ss-card-chevron" })
        ]
      }
    ),
    open ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ss-card-body", children: [
      !writable && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "ss-card-readOnly", role: "status", children: t("readOnly") }),
      FIELDS.map((field) => {
        const invalid = invalidField(field);
        const isTime = field.kind === "time";
        const labelKey = field.labelKey;
        const hintKey = field.hintKey;
        const userHas = isUserOverridden(field.key);
        const fieldId = `ss-${field.key}`;
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ss-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ss-card-fieldHead", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { htmlFor: fieldId, className: "ss-card-label", children: t(labelKey) }),
            userHas && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "ss-card-badges", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ss-card-badge", children: t("overriddenLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  className: "ss-card-reset",
                  disabled: !writable || saving,
                  onClick: () => handleResetField(field),
                  children: t("resetLabel")
                }
              )
            ] })
          ] }),
          field.kind === "boolean" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "select",
            {
              id: fieldId,
              className: invalid !== null ? "ss-input ss-inputInvalid" : "ss-input",
              "aria-invalid": invalid !== null || void 0,
              value: displayValue(field) === "false" ? "false" : "true",
              disabled: !writable || saving,
              onChange: (event) => handleFieldEdit(field, event.target.value),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "true", children: t("optionOn") }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "false", children: t("optionOff") })
              ]
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              id: fieldId,
              type: isTime ? "time" : "text",
              inputMode: isTime ? void 0 : "numeric",
              className: invalid !== null ? "ss-input ss-inputInvalid" : "ss-input",
              "aria-invalid": invalid !== null || void 0,
              value: displayValue(field),
              placeholder: field.kind === "number" ? String(field.defaultValue) : void 0,
              disabled: !writable || saving,
              onChange: (event) => handleFieldEdit(field, event.target.value)
            }
          ),
          invalid !== null || hintKey !== void 0 && t(hintKey).length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: invalid !== null ? "ss-card-invalid" : "ss-hint", children: invalid !== null ? invalid : t(hintKey) }) : null
        ] }, field.key);
      }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ss-card-footer", children: [
        failed && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "ss-card-failed", role: "status", children: t("saveFailed") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            className: "ss-card-discard",
            disabled: !dirty || saving,
            onClick: handleDiscard,
            children: t("discard")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            className: "ss-card-save",
            disabled: saveDisabled,
            onClick: () => void handleSave(),
            children: saving ? t("saving") : t("save")
          }
        )
      ] })
    ] }) : null
  ] });
}

// src/presence.ts
var PRESENCE_URGENT_WINDOW_MS = 5 * 6e4;
function summarizeSchedules(schedules) {
  let nextAt;
  let count = 0;
  let pausedCount = 0;
  for (const item of schedules ?? []) {
    const raw = item.scheduled_at ?? item.scheduledAt;
    if (raw === void 0) continue;
    const epoch = Date.parse(raw);
    if (!Number.isFinite(epoch)) continue;
    count += 1;
    if (item.status === "paused") {
      pausedCount += 1;
      continue;
    }
    if (nextAt === void 0 || epoch < nextAt) nextAt = epoch;
  }
  if (count === 0) return { count: 0, pausedCount: 0 };
  return nextAt === void 0 ? { count, pausedCount } : { count, nextAt, pausedCount };
}
function badgeStateFor(nextAt, now) {
  if (nextAt === void 0) return "scheduled";
  const diff = nextAt - now;
  if (diff <= 0) return "overdue";
  if (diff <= PRESENCE_URGENT_WINDOW_MS) return "urgent";
  return "scheduled";
}
function hoverScheduleStatus(entry, now, labels, strings, formatHhmm3, formatDate2) {
  const tone = badgeStateFor(entry.nextAt, now);
  if (entry.nextAt === void 0 && entry.pausedCount > 0) {
    const paused = strings.hoverSchedulePaused ?? strings.hoverScheduleOverdue;
    return { label: formatTemplate(paused, { n: entry.count }), tone };
  }
  if (tone === "overdue" || entry.nextAt === void 0) {
    return { label: formatTemplate(strings.hoverScheduleOverdue, { n: entry.count }), tone };
  }
  const time = relativeFireLabel(entry.nextAt, now, labels, formatHhmm3, formatDate2);
  return { label: formatTemplate(strings.hoverScheduleStatus, { n: entry.count, time }), tone };
}
function formatTemplate(template, params) {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key) => key in params ? String(params[key]) : match
  );
}
function startOfDay(epoch) {
  const d = new Date(epoch);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function relativeFireLabel(nextAt, now, labels, formatHhmm3, formatDate2) {
  const diff = nextAt - now;
  if (diff <= 0) return labels.clock(formatHhmm3(nextAt));
  if (diff <= 6e4) return labels.imminent;
  if (diff < 36e5) return labels.minutes(Math.max(1, Math.round(diff / 6e4)));
  const dayDiff = Math.round((startOfDay(nextAt) - startOfDay(now)) / 864e5);
  const time = formatHhmm3(nextAt);
  if (dayDiff <= 0) return labels.hours(Math.max(1, Math.round(diff / 36e5)));
  if (dayDiff === 1) return labels.tomorrow(time);
  return labels.date(formatDate2(nextAt), time);
}

// src/client/session-presence.ts
var BADGE_CLASS = "ss-presence";
var HOVER_ROW_CLASS = "ss-hover-status";
var FIBER_MAX_DEPTH = 8;
var SCAN_DEBOUNCE_MS = 60;
var STATE_TICK_MS = 3e4;
var REFRESH_INTERVAL_MS = 6e4;
var CLOCK_SVG = '<svg width="10" height="10" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><g class="ss-presence-ring"><rect x="0" y="0" width="2" height="2"/><rect x="4" y="0" width="2" height="2"/><rect x="8" y="0" width="2" height="2"/><rect x="8" y="4" width="2" height="2"/><rect x="8" y="8" width="2" height="2"/><rect x="4" y="8" width="2" height="2"/><rect x="0" y="8" width="2" height="2"/><rect x="0" y="4" width="2" height="2"/></g><g class="ss-presence-hand"><rect x="4" y="2" width="2" height="2"/><rect x="6" y="4" width="2" height="2"/></g></svg>';
var hhmmFormatter = new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit", hour12: false });
var dateFormatter = new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric" });
var formatHhmm2 = (epoch) => hhmmFormatter.format(epoch);
var formatDate = (epoch) => dateFormatter.format(epoch);
function sessionIdOfRow(row) {
  return sessionIdOfNode(row);
}
function sessionIdOfHoverCard(card) {
  return sessionIdOfNode(card);
}
function sessionIdOfNode(element) {
  const host = element;
  const fiberKey = Object.keys(host).find((key) => key.startsWith("__reactFiber$"));
  if (fiberKey === void 0) return void 0;
  let fiber = host[fiberKey];
  for (let depth = 0; fiber !== void 0 && depth < FIBER_MAX_DEPTH; depth += 1, fiber = fiber.return) {
    const node = fiber.memoizedProps?.node;
    const id = node?.id;
    if (typeof id === "string" && id.startsWith("session-")) return id;
  }
  return void 0;
}
function buildIndex(state) {
  const index = /* @__PURE__ */ new Map();
  for (const [sessionId, summary] of Object.entries(state.byId)) {
    const schedules = summary.projectionValues?.["userSchedules"]?.schedules;
    const entry = summarizeSchedules(schedules);
    if (entry.count > 0) index.set(sessionId, entry);
  }
  return index;
}
function findBadge(row) {
  for (const child of Array.from(row.children)) {
    if (child.classList.contains(BADGE_CLASS)) return child;
    const inside = child.querySelector(`:scope > .${BADGE_CLASS}`);
    if (inside !== null) return inside;
  }
  return null;
}
function labelsFor(dict) {
  return {
    imminent: dict.dueAnyMoment,
    minutes: (m) => format(dict.relMinutes, { m }),
    hours: (h) => format(dict.relHours, { h }),
    tomorrow: (time) => format(dict.relTomorrow, { time }),
    clock: (time) => format(dict.relClock, { time }),
    date: (date, time) => format(dict.relDate, { date, time })
  };
}
function mountSessionPresence(options) {
  const { sessions, locale } = options;
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => void 0;
  }
  let index = /* @__PURE__ */ new Map();
  let scanTimer;
  let disposed = false;
  const dictForNow = () => dictFor(locale?.getSnapshot().active);
  const scan = () => {
    if (disposed) return;
    index = buildIndex(sessions.list.getSnapshot());
    const dict = dictForNow();
    const now = Date.now();
    for (const row of Array.from(document.querySelectorAll('[role="treeitem"][draggable="true"]'))) {
      if (row.hasAttribute("aria-expanded")) continue;
      applyBadge(row, now, dict);
    }
    applyHoverCard(now, dict);
  };
  const scheduleScan = () => {
    if (disposed || scanTimer !== void 0) return;
    scanTimer = setTimeout(() => {
      scanTimer = void 0;
      scan();
    }, SCAN_DEBOUNCE_MS);
  };
  function applyBadge(row, now, dict) {
    const sessionId = sessionIdOfRow(row);
    if (sessionId === void 0) return;
    const entry = index.get(sessionId);
    const existing = findBadge(row);
    if (entry === void 0) {
      existing?.remove();
      return;
    }
    const state = badgeStateFor(entry.nextAt, now);
    const time = entry.nextAt === void 0 ? "" : relativeFireLabel(entry.nextAt, now, labelsFor(dict), formatHhmm2, formatDate);
    const allPaused = entry.nextAt === void 0 && entry.pausedCount > 0;
    const aria = allPaused ? format(dict.presencePausedAria, { n: entry.count }) : state === "overdue" ? format(dict.presenceOverdueAria, { n: entry.count }) : format(dict.presenceBadgeAria, { n: entry.count, time });
    const tooltip = allPaused ? format(dict.presencePausedTooltip, { n: entry.count }) : state === "overdue" ? format(dict.presenceOverdueTooltip, { n: entry.count }) : format(dict.presenceTooltip, { n: entry.count, time });
    if (existing !== null) {
      if (existing.dataset.state !== state) existing.dataset.state = state;
      if (existing.getAttribute("aria-label") !== aria) existing.setAttribute("aria-label", aria);
      if (existing.getAttribute("title") !== tooltip) existing.setAttribute("title", tooltip);
      return;
    }
    const slot = row.firstElementChild;
    if (slot === null) return;
    const beside = slot.querySelector("svg") !== null;
    const badge = document.createElement("span");
    badge.className = beside ? `${BADGE_CLASS} ${BADGE_CLASS}-beside` : BADGE_CLASS;
    badge.dataset.state = state;
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", aria);
    badge.setAttribute("title", tooltip);
    badge.innerHTML = CLOCK_SVG;
    if (beside) slot.after(badge);
    else slot.append(badge);
  }
  function findHoverCard() {
    for (const card of Array.from(document.body.children)) {
      if (!(card instanceof HTMLElement)) continue;
      const statusHost = card.firstElementChild;
      if (!(statusHost instanceof HTMLElement)) continue;
      const hasStatusRow = Array.from(statusHost.children).some((child) => {
        const dot = child.firstElementChild;
        return child.children.length >= 2 && dot !== null && dot.tagName === "SPAN" && dot.getAttribute("aria-hidden") === "true";
      });
      if (!hasStatusRow) continue;
      const sessionId = sessionIdOfHoverCard(card);
      if (sessionId === void 0) continue;
      return { card, statusHost, sessionId };
    }
    return null;
  }
  function applyHoverCard(now, dict) {
    const found = findHoverCard();
    if (found === null) return;
    const { statusHost, sessionId } = found;
    const existing = statusHost.querySelector(`:scope > .${HOVER_ROW_CLASS}`);
    const entry = index.get(sessionId);
    if (entry === void 0) {
      existing?.remove();
      return;
    }
    const { label } = hoverScheduleStatus(entry, now, labelsFor(dict), dict, formatHhmm2, formatDate);
    const state = badgeStateFor(entry.nextAt, now);
    if (existing !== null) {
      const text2 = existing.lastElementChild;
      if (text2 !== null && text2.textContent !== label) text2.textContent = label;
      if (existing.dataset.state !== state) existing.dataset.state = state;
      return;
    }
    const row = document.createElement("div");
    row.className = HOVER_ROW_CLASS;
    row.dataset.state = state;
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.className = "ss-hover-status-dot";
    const text = document.createElement("span");
    text.textContent = label;
    row.append(dot, text);
    statusHost.append(row);
  }
  const unsubscribeList = sessions.list.subscribe(scheduleScan);
  const unsubscribeLocale = locale?.subscribe(scheduleScan);
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  const refreshNow = () => {
    if (disposed) return;
    try {
      void sessions.refresh().catch(() => void 0);
    } catch {
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      refreshNow();
      scheduleScan();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
  const stateTick = setInterval(scheduleScan, STATE_TICK_MS);
  const refreshTick = setInterval(() => {
    if (document.visibilityState === "visible") refreshNow();
  }, REFRESH_INTERVAL_MS);
  refreshNow();
  scheduleScan();
  return () => {
    disposed = true;
    if (scanTimer !== void 0) clearTimeout(scanTimer);
    clearInterval(stateTick);
    clearInterval(refreshTick);
    observer.disconnect();
    unsubscribeList();
    unsubscribeLocale?.();
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onVisible);
    for (const badge of Array.from(document.querySelectorAll(`.${BADGE_CLASS}`))) badge.remove();
    for (const row of Array.from(document.querySelectorAll(`.${HOVER_ROW_CLASS}`))) row.remove();
  };
}

// src/client/index.tsx
var INPUT_RIGHT_SLOT = "conversation.input.right";
var inject = ["slots", "sessions", "conversation", "settingsScope", "locale"];
var NS = "settings.plugins.later";
var SETTINGS_NS = "dsh-later";
function apply(ctx) {
  const slots = ctx.get("slots");
  const sessions = ctx.get("sessions");
  const settingsScope = ctx.get("settingsScope");
  const locale = ctx.get("locale");
  if (slots === void 0 || sessions === void 0) return;
  ctx.effect(() => injectStyles(), "dsh-later: styles");
  ctx.effect(
    () => mountSessionPresence({
      sessions,
      ...locale === void 0 ? {} : { locale }
    }),
    "dsh-later: presence"
  );
  if (locale !== void 0) {
    ctx.effect(() => locale.register(NS, {
      zh: {
        title: "\u5B9A\u65F6\u63D0\u9192",
        description: "\u914D\u7F6E\u4F1A\u8BDD\u5185\u5B9A\u65F6\u63D0\u9192\u7684\u53C2\u6570\u3002",
        pendingBadge: "\u672A\u4FDD\u5B58",
        expand: "\u5C55\u5F00\u8BBE\u7F6E",
        collapse: "\u6536\u8D77\u8BBE\u7F6E",
        readOnly: "\u672C\u90E8\u7F72\u7684\u8BBE\u7F6E\u4E3A\u53EA\u8BFB\u3002",
        showButtonLabel: "\u663E\u793A\u5B9A\u65F6\u6309\u94AE",
        showButtonHint: "\u5173\u95ED\u540E\u8F93\u5165\u6846\u53F3\u4FA7\u4E0D\u518D\u663E\u793A\u65F6\u949F\u6309\u94AE\uFF1B\u5DF2\u521B\u5EFA\u7684\u63D0\u9192\u4ECD\u4F1A\u7167\u5E38\u89E6\u53D1\uFF0C\u5E76\u5728\u8F93\u5165\u6846\u4E0B\u65B9\u7684\u5F85\u53D1\u9001\u5217\u8868\u4E2D\u663E\u793A\u3002",
        optionOn: "\u663E\u793A",
        optionOff: "\u9690\u85CF",
        maxSchedulesLabel: "\u5355\u4F1A\u8BDD\u4EFB\u52A1\u4E0A\u9650",
        maxSchedulesHint: "\u5355\u4E2A\u4F1A\u8BDD\u5185\u5141\u8BB8\u521B\u5EFA\u7684\u6700\u5927\u5B9A\u65F6\u4EFB\u52A1\u6570\u91CF\u3002",
        smartWindowHint: "\u7528\u4E8E\u300C\u5DE5\u4F5C\u65F6\u95F4\u300D\u82AF\u7247\u4E0E\u667A\u80FD\u6A21\u5F0F\u81EA\u52A8\u6392\u671F\u3002",
        workStartLabel: "\u5DE5\u4F5C\u65F6\u95F4\u5F00\u59CB",
        workEndLabel: "\u5DE5\u4F5C\u65F6\u95F4\u7ED3\u675F\uFF08\u665A\u95F4\u5F00\u59CB\uFF09",
        lunchStartLabel: "\u5348\u4F11\u5F00\u59CB",
        lunchEndLabel: "\u5348\u4F11\u7ED3\u675F",
        eveningEndLabel: "\u591C\u95F4\u9759\u9ED8\u8D77\u70B9",
        overriddenLabel: "\u5DF2\u8986\u76D6",
        resetLabel: "\u91CD\u7F6E",
        invalidLabel: "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6570\u5B57\u3002",
        invalidTimeLabel: "\u8BF7\u4F7F\u7528 HH:mm 24 \u5C0F\u65F6\u5236\u65F6\u95F4\u3002",
        save: "\u4FDD\u5B58",
        saving: "\u4FDD\u5B58\u4E2D\u2026",
        discard: "\u653E\u5F03\u4FEE\u6539",
        saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
        loading: "\u52A0\u8F7D\u4E2D\u2026",
        unavailable: "\u8BBE\u7F6E\u6682\u4E0D\u53EF\u7528\u3002"
      },
      en: {
        title: "Session Scheduler",
        description: "Configure in-session scheduled reminders.",
        pendingBadge: "Unsaved",
        expand: "Show settings",
        collapse: "Hide settings",
        readOnly: "Settings for this deployment are read-only.",
        showButtonLabel: "Show schedule button",
        showButtonHint: "Hide the clock button on the input bar. Existing reminders keep firing and stay visible in the dock below the composer.",
        optionOn: "Show",
        optionOff: "Hide",
        maxSchedulesLabel: "Max schedules per session",
        maxSchedulesHint: "Maximum number of scheduled reminders allowed per session.",
        smartWindowHint: "Used by the Work-hours chip and smart auto-scheduling.",
        workStartLabel: "Work day start",
        workEndLabel: "Work day end (evening start)",
        lunchStartLabel: "Lunch break start",
        lunchEndLabel: "Lunch break end",
        eveningEndLabel: "Night quiet starts at",
        overriddenLabel: "Overridden",
        resetLabel: "Reset",
        invalidLabel: "Please enter a valid number.",
        invalidTimeLabel: "Use 24-hour HH:mm format.",
        save: "Save",
        saving: "Saving\u2026",
        discard: "Discard",
        saveFailed: "Save failed, please try again.",
        loading: "Loading\u2026",
        unavailable: "Settings unavailable."
      }
    }), "dsh-later: locale");
  }
  const callCommand = async (sessionId, line) => {
    const actx = sessions.scope(sessionId);
    const face = actx === void 0 ? void 0 : sessions.sessionOf(actx);
    if (face === void 0) return { matched: false };
    try {
      const result = await face.command(line);
      return { matched: result?.ok === true && result.value?.matched === true };
    } catch {
      return { matched: false };
    }
  };
  const schedulerScope = settingsScope === void 0 ? void 0 : settingsScope.bind({ namespace: SETTINGS_NS });
  ctx.slots.inject(
    INPUT_RIGHT_SLOT,
    () => ctx.slots.register(
      {
        name: INPUT_RIGHT_SLOT,
        id: "later",
        order: 50,
        inject: () => ({ callCommand, locale, schedulerScope })
      },
      SchedButton
    )
  );
  ctx.slots.inject(
    "conversation.input.dock",
    () => ctx.slots.register(
      {
        name: "conversation.input.dock",
        id: "later-dock",
        order: 30,
        inject: () => ({ callCommand, locale })
      },
      ScheduleDock
    )
  );
  if (settingsScope !== void 0 && locale !== void 0) {
    ctx.slots.inject("settings.plugin.item", function* () {
      yield ctx.slots.register({
        name: "settings.plugin.item",
        key: SETTINGS_NS,
        locale: NS,
        inject: () => ({
          scope: settingsScope.bind({ namespace: SETTINGS_NS }),
          t: locale.bind(NS)
        })
      }, SchedulerSettingsCard);
    });
  }
}

		return module.exports;
	}
});
