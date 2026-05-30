import { useState, useEffect } from 'react';
import { SectionCard } from './MemorySection';
import styles from '../SettingsPage.module.css';

export default function DynamicBgSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [bgTheme, setBgTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('bonnext_bg_theme') || 'minimal';
    } catch {
      return 'minimal';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_bg_theme', bgTheme);
    } catch {
      /* empty */
    }
  }, [bgTheme]);
  useEffect(() => {
    document.documentElement.classList.remove('bg-cyberpunk', 'bg-starfield', 'bg-matrix', 'bg-minimal');
    document.documentElement.classList.add(`bg-${bgTheme}`);
  }, [bgTheme]);

  return (
    <SectionCard id="sec-dynamic-bg" title={t('settings.dynamicBg')}>
      <div className={styles.bgPresetRow}>
        {[
          {
            key: 'cyberpunk',
            icon: '\u2B21',
            label: t('settings.dynamicBgCyberpunk'),
            hint: t('settings.dynamicBgHintCyberpunk'),
          },
          {
            key: 'starfield',
            icon: '\u2726',
            label: t('settings.dynamicBgStarfield'),
            hint: t('settings.dynamicBgHintStarfield'),
          },
          {
            key: 'matrix',
            icon: '\u229E',
            label: t('settings.dynamicBgMatrix'),
            hint: t('settings.dynamicBgHintMatrix'),
          },
          {
            key: 'minimal',
            icon: '\u25CB',
            label: t('settings.dynamicBgMinimal'),
            hint: t('settings.dynamicBgHintMinimal'),
          },
        ].map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`${styles.bgPresetBtn} ${bgTheme === preset.key ? styles['bgPresetBtn--active'] : ''}`}
            onClick={() => setBgTheme(preset.key)}
          >
            <span className={styles.bgPresetBtn__icon}>{preset.icon}</span>
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.bgPresetBtn__hint}>
        {
          [
            { key: 'cyberpunk', hint: t('settings.dynamicBgHintCyberpunk') },
            { key: 'starfield', hint: t('settings.dynamicBgHintStarfield') },
            { key: 'matrix', hint: t('settings.dynamicBgHintMatrix') },
            { key: 'minimal', hint: t('settings.dynamicBgHintMinimal') },
          ].find((p) => p.key === bgTheme)?.hint
        }
      </div>
    </SectionCard>
  );
}
