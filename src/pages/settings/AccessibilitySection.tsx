import { useState, useEffect } from 'react';
import { Select } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';

export default function AccessibilitySection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [colorblindMode, setColorblindMode] = useState<string>(() => {
    try {
      return localStorage.getItem('bonnext_colorblind_mode') || 'none';
    } catch {
      return 'none';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_colorblind_mode', colorblindMode);
    } catch {
      /* empty */
    }
  }, [colorblindMode]);
  useEffect(() => {
    document.documentElement.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia');
    if (colorblindMode !== 'none') {
      document.documentElement.classList.add(`cb-${colorblindMode}`);
    }
  }, [colorblindMode]);

  return (
    <SectionCard id="sec-accessibility" title={t('settings.accessibility')}>
      <SettingRow label={t('settings.colorblindMode')}>
        <div style={{ minWidth: 160 }}>
          <Select
            value={colorblindMode}
            onChange={(e) => setColorblindMode(e.target.value)}
            options={[
              { value: 'none', label: t('settings.colorblindNone') },
              { value: 'protanopia', label: t('settings.colorblindProtanopia') },
              { value: 'deuteranopia', label: t('settings.colorblindDeuteranopia') },
              { value: 'tritanopia', label: t('settings.colorblindTritanopia') },
            ]}
          />
        </div>
      </SettingRow>
    </SectionCard>
  );
}
