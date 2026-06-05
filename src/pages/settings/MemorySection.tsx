import { useState, useEffect, useMemo } from 'react';
import type { AppConfig } from '../../api';
import type { HardwareProfile, RecommendedConfig } from '../../api';
import { api } from '../../api';
import { Slider, Checkbox, Select, Badge, Button, ContextHelp } from '../../components/ui';
import { useDebouncedCallback } from '../../shared/hooks/useDebouncedCallback';
import { useFormField } from '../../shared/hooks/useFormField';
import { memoryRange } from '../../utils/validators';
import { useConfig } from '../../shared/stores/configStore';
import { useToast } from '../../shared/stores/toastStore';
import formStyles from '../../components/ui/FormField.module.css';
import styles from '../SettingsPage.module.css';

const RESOLUTION_OPTIONS = [
  { value: '854x480', label: '854 × 480' },
  { value: '1280x720', label: '1280 × 720' },
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '2560x1440', label: '2560 × 1440' },
  { value: '3840x2160', label: '3840 × 2160' },
];

export function SectionCard({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div className={styles.sectionCard} id={id}>
      <div className={styles.sectionCard__header}>
        <div className={styles.sectionCard__bar} />
        <span className={styles.sectionCard__title}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingRow__label}>{label}</span>
      {children}
    </div>
  );
}

export { RESOLUTION_OPTIONS };

export default function MemorySection({
  localConfig,
  onConfigChange,
  t,
  hardwareProfile,
}: {
  localConfig: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => void;
  t: (key: string, params?: Record<string, string>) => string;
  hardwareProfile: HardwareProfile | null;
}) {
  const [memoryGB, setMemoryGB] = useState(Math.round(localConfig.max_memory / 1024));
  const maxMemoryGB = Math.max(16, Math.floor((hardwareProfile?.total_ram_mb || 16384) / 1024));
  const { updateConfigOptimistic } = useConfig();
  const { addToast } = useToast();
  const [recommended, setRecommended] = useState<RecommendedConfig | null>(null);

  const memoryRules = useMemo(() => [memoryRange(512, 32768)], []);
  const memoryField = useFormField(String(localConfig.max_memory), memoryRules);

  const memoryError = memoryField.error;

  const debouncedSave = useDebouncedCallback(async (updates: Partial<AppConfig>) => {
    try {
      await updateConfigOptimistic(updates);
    } catch (e) {
      addToast({
        type: 'error',
        title: t('settings.saveFailed') || 'Save failed',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }, 500);

  useEffect(() => {
    setMemoryGB(Math.round(localConfig.max_memory / 1024));
  }, [localConfig.max_memory]);

  useEffect(() => {
    api
      .getRecommendedConfig()
      .then(setRecommended)
      .catch(() => {});
  }, []);

  const recommendedGB = recommended ? Math.round(recommended.max_memory / 1024) : null;
  const differsFromRecommended = recommendedGB !== null && memoryGB !== recommendedGB;

  const handleApplyRecommended = () => {
    if (!recommended) return;
    const updates = { max_memory: recommended.max_memory, min_memory: recommended.min_memory };
    setMemoryGB(recommendedGB!);
    onConfigChange(updates);
    debouncedSave(updates);
  };

  return (
    <SectionCard id="sec-memory" title={t('settings.memory')}>
      <SettingRow label={t('settings.allocatedMemory')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <ContextHelp
            content={
              t('settings.memoryHelp') ||
              'Controls how much RAM Minecraft can use. 2–4 GB for modded, 4–8 GB for heavy modpacks. Allocating too much can cause lag.'
            }
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF' }}>
            {memoryGB} {t('common.unit.gb')}
          </span>
          <div style={{ flex: 1 }}>
            <Slider
              gradient
              value={memoryGB}
              min={1}
              max={maxMemoryGB}
              onChange={(val) => {
                setMemoryGB(val);
                const mbVal = val * 1024;
                memoryField.setValue(String(mbVal));
                memoryField.validate();
                const updates = { max_memory: mbVal };
                onConfigChange(updates);
                debouncedSave(updates);
              }}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: '#555' }}>
            {memoryGB} {t('common.unit.gb')}
          </span>
        </div>
        {memoryError && <div className={formStyles.errorText}>{memoryError}</div>}
      </SettingRow>

      {recommended && (
        <SettingRow label="">
          <div className={styles.recommendedRow}>
            <div className={styles.recommendedInfo}>
              <Badge variant="accent">{t('settings.recommended') || '推荐'}</Badge>
              <span className={styles.recommendedValue}>
                {recommendedGB} {t('common.unit.gb')}
              </span>
              {differsFromRecommended && (
                <span className={styles.recommendedDiff}>{t('settings.currentDiffers') || '当前值与推荐值不同'}</span>
              )}
            </div>
            {differsFromRecommended && (
              <Button variant="secondary" size="sm" onClick={handleApplyRecommended}>
                {t('settings.useRecommended') || '使用推荐值'}
              </Button>
            )}
          </div>
        </SettingRow>
      )}

      <SettingRow label={t('settings.forceMemory')}>
        <label className={styles.checkboxLabel}>
          <Checkbox
            on={localConfig.force_memory || false}
            onChange={() => {
              const updates = { force_memory: !localConfig.force_memory };
              onConfigChange(updates);
              debouncedSave(updates);
            }}
          />
          <span
            className={localConfig.force_memory ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}
          >
            {t('settings.forceMemoryDesc')}
          </span>
        </label>
      </SettingRow>

      <SettingRow label={t('settings.resolution')}>
        <div style={{ minWidth: 180 }}>
          <Select
            value={`${localConfig.window_width}x${localConfig.window_height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              const updates = { window_width: w, window_height: h };
              onConfigChange(updates);
              debouncedSave(updates);
            }}
            options={RESOLUTION_OPTIONS}
          />
        </div>
      </SettingRow>
    </SectionCard>
  );
}
