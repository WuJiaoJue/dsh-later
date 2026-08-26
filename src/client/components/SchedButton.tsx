/**
 * 输入框右侧的定时按钮 + 倒计时芯片（PRD §3.2.1 / §3.2.5 / docs/ui 01 §1）。
 * 注册在 `conversation.input.right` 插槽（order 50）。
 *
 * 逻辑已抽取到 `useSchedules` hook；本组件只负责渲染。
 * @module dsh-session-scheduler/client/components/SchedButton
 */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { detectTimeZone } from '../../time-utils.js';
import { strings } from '../strings.js';
import type { ClientSchedule, CreateCommandPayload } from '../types.js';
import { SchedPanel } from './SchedPanel.js';
import { useSchedules } from '../hooks/useSchedules.js';

/** 应用层注入的调用能力。 */
export interface SchedButtonInjected {
  /** 向宿主执行一条 slash 命令；返回是否受理。 */
  callCommand: (sessionId: string, line: string) => Promise<boolean>;
}

/** 会话作用域插槽条目收到的标准 props + 注入。 */
export interface SchedButtonProps extends SchedButtonInjected {
  /** InputZone owner 提供的输入快照。 */
  input?: { readonly draft: string };
  /** 会话作用域标准 hook：读取草稿。 */
  useInput?: (selector: (state: { draft: string }) => string) => string;
  /** 会话作用域标准 hook：读取投影。 */
  useProjection?: (key: string) => { schedules?: readonly ClientSchedule[] } | undefined;
  /** 会话 id。 */
  sessionId?: string;
  /** 输入动作：清空输入框。 */
  inputActions?: { setDraft(text: string): void };
}

export function SchedButton(props: SchedButtonProps): JSX.Element {
  const { callCommand, sessionId, inputActions, input, useProjection, useInput } = props;
  const [open, setOpen] = useState(false);

  const {
    draft,
    schedules,
    enabled,
    busy,
    anchorBottom,
    reposition,
    handleCreate,
    handleDelete,
    rowRef,
  } = useSchedules({
    callCommand,
    sessionId,
    inputActions,
    input,
    useProjection,
    useInput,
  });

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('resize', reposition);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, reposition]);

  const handleCreateWithErrorBoundary = async (inputPayload: CreateCommandPayload): Promise<void> => {
    try {
      await handleCreate(inputPayload);
    } catch {
      setOpen(false);
      throw new Error('命令未被受理');
    }
  };

  return (
    <span ref={rowRef} className="ss-sched-row" data-ss-sched-row="">
      <button
        type="button"
        className={open ? 'ss-sched-btn ss-active' : 'ss-sched-btn'}
        title={strings.buttonSchedule}
        aria-label={strings.buttonSchedule}
        aria-expanded={open}
        disabled={!enabled}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </button>
      {open && (
        <>
          <div className="ss-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <SchedPanel
            defaultPrompt={draft}
            schedules={schedules}
            timeZone={detectTimeZone()}
            busy={busy}
            onClose={() => setOpen(false)}
            onCreate={handleCreateWithErrorBoundary}
            onDelete={(id) => void handleDelete(id)}
            bottom={anchorBottom}
          />
        </>
      )}
    </span>
  );
}
