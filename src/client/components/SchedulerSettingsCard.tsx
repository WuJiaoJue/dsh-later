import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import { isValidHhmm } from '../../smart-window.js';

/** 设置面存储形态（与 SchedulerSettingsSchema 一致，缺省字段表示回退默认）。 */
export interface SchedulerSettings {
  maxSchedules?: number;
  workStart?: string;
  workEnd?: string;
  lunchStart?: string;
  lunchEnd?: string;
  eveningEnd?: string;
}

/** 字段元数据（顺序固定，便于稳定渲染）。 */
type FieldDef =
  | { readonly kind: 'number'; readonly key: 'maxSchedules'; readonly labelKey: string; readonly hintKey: string; readonly defaultValue: number }
  | { readonly kind: 'time'; readonly key: 'workStart' | 'workEnd' | 'lunchStart' | 'lunchEnd' | 'eveningEnd'; readonly labelKey: string };

const FIELDS: readonly FieldDef[] = [
  { kind: 'number', key: 'maxSchedules', labelKey: 'maxSchedulesLabel', hintKey: 'maxSchedulesHint', defaultValue: 100 },
  { kind: 'time', key: 'workStart', labelKey: 'workStartLabel' },
  { kind: 'time', key: 'workEnd', labelKey: 'workEndLabel' },
  { kind: 'time', key: 'lunchStart', labelKey: 'lunchStartLabel' },
  { kind: 'time', key: 'lunchEnd', labelKey: 'lunchEndLabel' },
  { kind: 'time', key: 'eveningEnd', labelKey: 'eveningEndLabel' },
] as const;

/** 单字段的 pending 编辑意图：`{value, reset:true}` 表示点击 reset 等待保存。 */
type Pending = { readonly value: string; readonly reset: boolean };
type PendingMap = Partial<Record<string, Pending>>;

export interface SchedulerSettingsCardProps {
  scope: SettingsScope<SchedulerSettings>;
  t: (key: string) => string;
}

/**
 * 定时提醒插件设置卡片（设置 → 插件）。
 *
 * 字段分两段：单会话任务上限（数字）+ 智能时段 5 个 HH:mm 字段。
 *
 * 状态模型（对齐 dsh-auto-collapse）：每个字段维护独立的 `pending` 中间态
 * （待保存的 value + reset 意图）；保存时按字段批量写。`reset` 表示「点击了
 * reset 按钮但尚未保存」，实际写入由 save 统一调用 `unset` 完成。
 *
 * 已覆盖徽章按字段独立显示（snapshot.user 含该 key 即视为覆盖）；reset
 * 链接恢复该字段到 base 层（即 yml config）——若 base 未设则回退 schema default。
 *
 * 卡片顶部标题栏：title + description + pending 徽章 + 折叠 chevron（沿用
 * PluginCard 框架）。Body 内字段 + 底部 save/discard 按钮（任一字段 dirty
 * 即触发；任一字段非法阻断保存）。
 */
export function SchedulerSettingsCard({ scope, t }: SchedulerSettingsCardProps): JSX.Element {
  const [snapshot, setSnapshot] = useState(() => scope.getSnapshot());
  const [pending, setPending] = useState<PendingMap>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const initial = scope.getSnapshot();
    setSnapshot(initial);
    setPending({});
    if (initial.status === 'ready') setFailed(false);
  }, [scope]);

  useEffect(() => {
    return scope.subscribe(() => {
      const snap = scope.getSnapshot();
      setSnapshot(snap);
      if (snap.status === 'ready') {
        setFailed(false);
      }
    });
  }, [scope]);

  if (snapshot.status !== 'ready') {
    if (snapshot.status === 'loading') return <div className="ss-hint">{t('loading')}</div>;
    return <div className="ss-hint">{t('unavailable')}</div>;
  }

  const value = snapshot.value ?? {};
  const base = snapshot.base ?? {};
  const user = snapshot.user;
  const writable = snapshot.writable === true;

  /** 该字段用户层是否覆盖。 */
  const isUserOverridden = (key: string): boolean =>
    user !== undefined &&
    typeof user === 'object' &&
    Object.prototype.hasOwnProperty.call(user as object, key);

  /** 该字段当前展示文本：pending 优先于已保存。 */
  const displayValue = (field: FieldDef): string => {
    const p = pending[field.key];
    if (p !== undefined) return p.value;
    if (field.kind === 'number') {
      const v = value[field.key];
      return v === undefined ? '' : String(v);
    }
    const v = value[field.key];
    return v ?? '';
  };

  /** 该字段 baseline（reset 后的值，即 base 或默认）。 */
  const baselineValue = (field: FieldDef): string => {
    if (field.kind === 'number') {
      const v = base[field.key];
      return String(v ?? field.defaultValue);
    }
    const v = base[field.key];
    return v ?? '';
  };

  const dirty =
    Object.keys(pending).length > 0 &&
    Object.values(pending).some((p) => p !== undefined);

  const validate = (field: FieldDef, raw: string): string | null => {
    if (field.kind === 'number') {
      if (raw.trim().length === 0) return t('invalidLabel');
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 1 || !Number.isInteger(num)) return t('invalidLabel');
      return null;
    }
    if (raw.trim().length === 0) return null; // 空 = unset
    if (!isValidHhmm(raw)) return t('invalidTimeLabel');
    return null;
  };

  const setFieldPending = (key: string, value: string, reset: boolean): void => {
    setPending((current) => ({ ...current, [key]: { value, reset } }));
  };

  const handleFieldEdit = (field: FieldDef, raw: string): void => {
    setFieldPending(field.key, raw, false);
    setFailed(false);
  };

  const handleResetField = (field: FieldDef): void => {
    setFieldPending(field.key, baselineValue(field), true);
    setFailed(false);
  };

  const handleDiscard = useCallback(() => {
    setPending({});
    setFailed(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!dirty || saving || !writable) return;
    setSaving(true);
    setFailed(false);
    try {
      for (const [key, p] of Object.entries(pending)) {
        if (p === undefined) continue;
        if (p.reset) {
          await scope.unset(key as keyof SchedulerSettings);
          continue;
        }
        // 空串视为「回退默认」，unset 比 set 空值更直观。
        if (p.value.trim().length === 0) {
          await scope.unset(key as keyof SchedulerSettings);
          continue;
        }
        const field = FIELDS.find((entry) => entry.key === key);
        const coerced = field?.kind === 'number' ? Number(p.value) : p.value;
        await scope.set(key as keyof SchedulerSettings, coerced as never);
      }
      setPending({});
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [scope, pending, dirty, saving, writable]);

  // 校验所有 pending 字段（已弃 dirty 字段忽略）。
  const invalidField = (field: FieldDef): string | null => {
    const p = pending[field.key];
    if (p === undefined) return null;
    return validate(field, p.value);
  };
  const anyInvalid = FIELDS.some((field) => invalidField(field) !== null);
  const saveDisabled = !dirty || saving || !writable || anyInvalid;

  return (
    <div className="ss-card-root">
      <div className="ss-card-head">
        <div className="ss-card-headText">
          <div className="ss-card-title">{t('title')}</div>
          <div className="ss-card-description">{t('description')}</div>
        </div>
        {dirty && <span className="ss-card-pending">{t('pendingBadge')}</span>}
      </div>

      <div className="ss-card-body">
        {!writable && <p className="ss-readonly">{t('readOnly')}</p>}

        {FIELDS.map((field, index) => {
          const invalid = invalidField(field);
          const isTime = field.kind === 'time';
          const labelKey = field.labelKey;
          const hintKey = field.kind === 'number' ? field.hintKey : undefined;
          const userHas = isUserOverridden(field.key);
          const fieldId = `ss-${field.key}`;
          return (
            <div className="ss-field" key={field.key}>
              <div className="ss-field-head">
                <label htmlFor={fieldId} className="ss-field-label">
                  {t(labelKey)}
                </label>
                {userHas && (
                  <span className="ss-field-head-right">
                    <span className="ss-badge">{t('overriddenLabel')}</span>
                    <button
                      type="button"
                      className="ss-reset"
                      disabled={!writable || saving}
                      onClick={() => handleResetField(field)}
                    >
                      {t('resetLabel')}
                    </button>
                  </span>
                )}
              </div>
              <input
                id={fieldId}
                type={isTime ? 'time' : 'text'}
                inputMode={isTime ? undefined : 'numeric'}
                className={invalid !== null ? 'ss-input ss-invalid' : 'ss-input'}
                aria-invalid={invalid !== null || undefined}
                value={displayValue(field)}
                placeholder={
                  field.kind === 'number'
                    ? String(field.defaultValue)
                    : undefined
                }
                disabled={!writable || saving}
                onChange={(event) => handleFieldEdit(field, event.target.value)}
              />
              <p className={invalid !== null ? 'ss-error' : 'ss-hint'}>
                {invalid !== null ? invalid : hintKey !== undefined ? t(hintKey) : ''}
              </p>
              {field.kind === 'time' && index === FIELDS.length - 5 && (
                <p className="ss-subhint">{t('smartWindowHint')}</p>
              )}
            </div>
          );
        })}

        <div className="ss-settings-actions">
          {failed && <p className="ss-settings-error">{t('saveFailed')}</p>}
          <button
            type="button"
            className="ss-settings-discard"
            disabled={!dirty || saving}
            onClick={handleDiscard}
          >
            {t('discard')}
          </button>
          <button
            type="button"
            className="ss-settings-save"
            disabled={saveDisabled}
            onClick={() => void handleSave()}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}