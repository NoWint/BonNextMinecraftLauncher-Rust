import { useState, useEffect } from 'react';
import { Checkbox } from '../../components/ui';
import { SectionCard } from './MemorySection';
import styles from '../SettingsPage.module.css';

export default function MiniModeSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [miniMode, setMiniMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bonnext_mini_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_mini_mode', String(miniMode));
    } catch {
      /* empty */
    }
  }, [miniMode]);

  return (
    <SectionCard id="sec-mini-mode" title={t('settings.miniMode')}>
      <label className={styles.checkboxLabel}>
        <Checkbox on={miniMode} onChange={setMiniMode} />
        <span className={styles.checkboxLabel__text}>{t('settings.miniModeToggle')}</span>
      </label>
      <div className={styles.mutedDesc}>{t('settings.miniModeDescNew')}</div>
    </SectionCard>
  );
}
