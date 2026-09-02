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
  | { readonly kind: 'time'; readonly key: 'workStart' | 'workEnd' | 'lunchStart' | 'lunchEnd' | 'eveningEnd'; readonly labelKey: string; readonly hintKey?: string };

const FIELDS: readonly FieldDef[] = [
  { kind: 'number', key: 'maxSchedules', labelKey: 'maxSchedulesLabel', hintKey: 'maxSchedulesHint', defaultValue: 100 },
  { kind: 'time', key: 'workStart', labelKey: 'workStartLabel', hintKey: 'smartWindowHint' },
  { kind: 'time', key: 'workEnd', labelKey: 'workEndLabel' },
  { kind: 'time', key: 'lunchStart', labelKey: 'lunchStartLabel' },
  { kind: 'time', key: 'lunchEnd', labelKey: 'lunchEndLabel' },
  { kind: 'time', key: 'eveningEnd', labelKey: 'eveningEndLabel' },
] as const;

/** 单字段的 pending 编辑意图：`{value, reset:true}` 表示点击 reset 等待保存。 */
type Pending = { readonly value: string; readonly reset: boolean };
type PendingMap = Partial<Record<string, Pending>>;

/** 与官方 PluginCard 视觉一致的 chevron-down 图标（内联 SVG，零依赖）。 */
function ChevronDown({ className }: { className?: string }): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 5.25 7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface SchedulerSettingsCardProps {
  scope: SettingsScope<SchedulerSettings>;
  t: (key: string) => string;
}

/**
 * 定时提醒插件设置卡片（设置 → 插件 → 插件配置）。
 *
 * 视觉与交互对齐官方 PluginCard（dsh-client-ui-settings-plugins 内部私有组件，
 * bundle 纯净性门控禁止 import 其卡片 chrome/表单模型作为值，这里按相同结构
 * 自实现，参考 dsh-wakatime 同款做法）：
 *  - header 整卡按钮默认收起，点击展开/收起（折叠态只显示标题+描述）；
 *  - 有未保存草稿时 header 显示「未保存」徽章（折叠态也能看见）；
 *  - 字段为「label 行（覆盖徽章 + 重置）→ 输入控件 → 提示」三段式；
 *  - 非法草稿阻塞保存；保存后清空草稿；写入失败保留草稿并报错。
 *
 * 状态模型：每个字段维护独立的 `pending` 中间态（待保存的 value + reset 意图）；
 * 保存时按字段批量写。`reset` 表示「点击了 reset 按钮但尚未保存」，实际写入
 * 由 save 统一调用 `unset` 完成。空串视为「回退默认」→ unset。
 */
export function SchedulerSettingsCard({ scope, t }: SchedulerSettingsCardProps): JSX.Element {
  const [snapshot, setSnapshot] = useState(() => scope.getSnapshot());
  const [pending, setPending] = useState<PendingMap>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

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

  if (snapshot.status === 'unavailable') return null; // 命名空间未暴露时不显示卡片
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

  const dirty = Object.keys(pending).length > 0 && Object.values(pending).some((p) => p !== undefined);

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
    <li className={open ? 'ss-card ss-cardOpen' : 'ss-card'}>
      <button
        type="button"
        className="ss-card-header"
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => setOpen(!open)}
      >
        <span className="ss-card-headText">
          <span className="ss-card-name">{t('title')}</span>
          <span className="ss-card-description">{t('description')}</span>
        </span>
        {dirty && <span className="ss-card-pending">{t('pendingBadge')}</span>}
        <ChevronDown className={open ? 'ss-card-chevron ss-card-chevronOpen' : 'ss-card-chevron'} />
      </button>
      {open ? (
        <div className="ss-card-body">
          {!writable && (
            <p className="ss-card-readOnly" role="status">
              {t('readOnly')}
            </p>
          )}

          {FIELDS.map((field) => {
            const invalid = invalidField(field);
            const isTime = field.kind === 'time';
            const labelKey = field.labelKey;
            const hintKey = field.hintKey;
            const userHas = isUserOverridden(field.key);
            const fieldId = `ss-${field.key}`;
            return (
              <div className="ss-field" key={field.key}>
                <div className="ss-card-fieldHead">
                  <label htmlFor={fieldId} className="ss-card-label">
                    {t(labelKey)}
                  </label>
                  {userHas && (
                    <span className="ss-card-badges">
                      <span className="ss-card-badge">{t('overriddenLabel')}</span>
                      <button
                        type="button"
                        className="ss-card-reset"
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
                  className={invalid !== null ? 'ss-input ss-inputInvalid' : 'ss-input'}
                  aria-invalid={invalid !== null || undefined}
                  value={displayValue(field)}
                  placeholder={field.kind === 'number' ? String(field.defaultValue) : undefined}
                  disabled={!writable || saving}
                  onChange={(event) => handleFieldEdit(field, event.target.value)}
                />
                {invalid !== null || (hintKey !== undefined && t(hintKey).length > 0) ? (
                  <p className={invalid !== null ? 'ss-card-invalid' : 'ss-hint'}>
                    {invalid !== null ? invalid : t(hintKey as string)}
                  </p>
                ) : null}
              </div>
            );
          })}

          <div className="ss-card-footer">
            {failed && (
              <p className="ss-card-failed" role="status">
                {t('saveFailed')}
              </p>
            )}
            <button
              type="button"
              className="ss-card-discard"
              disabled={!dirty || saving}
              onClick={handleDiscard}
            >
              {t('discard')}
            </button>
            <button
              type="button"
              className="ss-card-save"
              disabled={saveDisabled}
              onClick={() => void handleSave()}
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
