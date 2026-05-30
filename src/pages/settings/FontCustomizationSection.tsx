import { useState, useEffect } from 'react';
import { Slider } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';
import styles from '../SettingsPage.module.css';

export default function FontCustomizationSection({
  t,
}: {
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const [fontWeight, setFontWeight] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('bonnext_font_weight')) || 400;
    } catch {
      return 400;
    }
  });
  const [fontLineHeight, setFontLineHeight] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('bonnext_font_line_height')) || 1.5;
    } catch {
      return 1.5;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_font_weight', String(fontWeight));
    } catch {
      /* empty */
    }
  }, [fontWeight]);
  useEffect(() => {
    try {
      localStorage.setItem('bonnext_font_line_height', String(fontLineHeight));
    } catch {
      /* empty */
    }
  }, [fontLineHeight]);
  useEffect(() => {
    document.documentElement.style.setProperty('--bonnext-font-weight', String(fontWeight));
    document.documentElement.style.setProperty('--bonnext-line-height', String(fontLineHeight));
  }, [fontWeight, fontLineHeight]);

  return (
    <SectionCard id="sec-font-custom" title={t('settings.fontCustomization')}>
      <SettingRow label={t('settings.fontWeight')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
            {fontWeight}
          </span>
          <div style={{ flex: 1 }}>
            <Slider gradient value={fontWeight} min={300} max={700} step={100} onChange={setFontWeight} />
          </div>
        </div>
      </SettingRow>
      <SettingRow label={t('settings.fontLineHeight')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
            {fontLineHeight.toFixed(1)}
          </span>
          <div style={{ flex: 1 }}>
            <Slider gradient value={fontLineHeight} min={1.2} max={2.0} step={0.1} onChange={setFontLineHeight} />
          </div>
        </div>
      </SettingRow>
      <div className={styles.fontPreview} style={{ fontWeight: fontWeight, lineHeight: fontLineHeight }}>
        <div style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
          {t('settings.fontPreview')}
        </div>
        <div style={{ fontSize: '0.7em' }}>{t('settings.fontPreviewText')}</div>
      </div>
    </SectionCard>
  );
}
