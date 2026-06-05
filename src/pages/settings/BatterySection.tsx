import { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { Checkbox } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';
import styles from '../SettingsPage.module.css';

export default function BatterySection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [batteryStatus, setBatteryStatus] = useState<{
    on_battery: boolean;
    percentage: number;
    charging: boolean;
  } | null>(null);
  const [powerSavingMode, setPowerSavingMode] = useState(() => {
    try {
      return localStorage.getItem('bonnext_power_saving') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    api
      .getBatteryStatus()
      .then(setBatteryStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_power_saving', String(powerSavingMode));
    } catch {
      /* empty */
    }
  }, [powerSavingMode]);

  return (
    <SectionCard id="sec-battery" title={t('settings.battery')}>
      <SettingRow label={t('settings.batteryStatus')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          {batteryStatus ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7em', color: 'var(--color-accent)' }}>
                {batteryStatus.percentage}%
              </span>
              <span style={{ fontSize: '0.55em', color: 'var(--color-text-secondary)' }}>
                {batteryStatus.charging
                  ? t('settings.batteryCharging')
                  : batteryStatus.on_battery
                    ? t('settings.batteryOnBattery')
                    : t('settings.acPower')}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '0.55em', color: 'var(--color-text-muted)' }}>{t('common.loading')}</span>
          )}
        </div>
      </SettingRow>
      <SettingRow label={t('settings.batteryPowerSaving')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <label className={styles.checkboxLabel}>
            <Checkbox on={powerSavingMode} onChange={() => setPowerSavingMode(!powerSavingMode)} />
            <span className={powerSavingMode ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              {t('settings.batteryPowerSavingDesc')}
            </span>
          </label>
        </div>
      </SettingRow>
    </SectionCard>
  );
}
