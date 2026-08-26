import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';

export interface SchedulerSettings {
  maxSchedules?: number;
}

export interface SchedulerSettingsCardProps {
  scope: SettingsScope<SchedulerSettings>;
  t: (key: string) => string;
}

/**
 * 定时提醒插件设置卡片（设置 → 插件）。
 *
 * 布局对齐官方 ValueField：label 在上（13px/500）、右侧「已覆盖」徽章 +
 * reset 链接、下方 34px 输入框、再下方 12px hint；底部 footer 右对齐
 * 保存/放弃按钮，中间显示失败信息。
 */
export function SchedulerSettingsCard({ scope, t }: SchedulerSettingsCardProps): JSX.Element {
  const [snapshot, setSnapshot] = useState(() => scope.getSnapshot());
  const [draft, setDraft] = useState<string>('');
  const [saved, setSaved] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // 初始 & 快照变化时回填已保存值（无未保存草稿时）。
  useEffect(() => {
    const snap = scope.getSnapshot();
    setSnapshot(snap);
    if (snap.status === 'ready') {
      const val = snap.value?.maxSchedules;
      setSaved(val);
      setDraft((prev) => (prev === '' || prev === String(saved) ? (val === undefined ? '' : String(val)) : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    return scope.subscribe(() => {
      const snap = scope.getSnapshot();
      setSnapshot(snap);
      if (snap.status === 'ready') {
        const val = snap.value?.maxSchedules;
        setSaved(val);
        setDraft(val === undefined ? '' : String(val));
        setFailed(false);
      }
    });
  }, [scope]);

  const num = Number(draft);
  const invalid = draft.trim().length > 0 && (!Number.isFinite(num) || num < 1 || !Number.isInteger(num));
  const dirty = draft !== (saved === undefined ? '' : String(saved));
  const writable = snapshot.writable && snapshot.status === 'ready';
  // 官方语义：字段出现在 user 层即视为「已覆盖」。
  const overridden =
    snapshot.user !== undefined &&
    typeof snapshot.user === 'object' &&
    'maxSchedules' in (snapshot.user as Record<string, unknown>);

  const handleSave = useCallback(async () => {
    if (invalid || !dirty || !writable) return;
    setSaving(true);
    setFailed(false);
    try {
      await scope.set('maxSchedules', Number(draft));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [scope, draft, invalid, dirty, writable]);

  const handleDiscard = useCallback(() => {
    setDraft(saved === undefined ? '' : String(saved));
    setFailed(false);
  }, [saved]);

  const handleReset = useCallback(async () => {
    if (!writable) return;
    setSaving(true);
    setFailed(false);
    try {
      await scope.unset('maxSchedules');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [scope, writable]);

  if (snapshot.status === 'loading') {
    return <div className="ss-hint">{t('loading')}</div>;
  }
  if (snapshot.status === 'unavailable') {
    return <div className="ss-hint">{t('unavailable')}</div>;
  }

  return (
    <div>
      <div className="ss-field">
        <div className="ss-field-head">
          <label htmlFor="ss-max-schedules" className="ss-field-label">
            {t('maxSchedulesLabel')}
          </label>
          {overridden && (
            <span className="ss-field-head-right">
              <span className="ss-badge">{t('overriddenLabel')}</span>
              <button type="button" className="ss-reset" disabled={!writable || saving} onClick={() => void handleReset()}>
                {t('resetLabel')}
              </button>
            </span>
          )}
        </div>
        <input
          id="ss-max-schedules"
          type="text"
          inputMode="numeric"
          className={invalid ? 'ss-input ss-invalid' : 'ss-input'}
          aria-invalid={invalid || undefined}
          value={draft}
          placeholder={saved === undefined ? String(100) : ''}
          disabled={!writable || saving}
          onChange={(e) => setDraft(e.target.value)}
        />
        <p className={invalid ? 'ss-error' : 'ss-hint'}>{invalid ? t('invalidLabel') : t('maxSchedulesHint')}</p>
      </div>

      <div className="ss-settings-actions">
        {failed && <p className="ss-settings-error">{t('saveFailed')}</p>}
        <button type="button" className="ss-settings-discard" disabled={!dirty || saving} onClick={handleDiscard}>
          {t('discard')}
        </button>
        <button
          type="button"
          className="ss-settings-save"
          disabled={!dirty || invalid || !writable || saving}
          onClick={() => void handleSave()}
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
