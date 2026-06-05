import { useState, useEffect } from 'react';
import { Slider } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';

export default function WindowEffectsSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [transparency, setTransparency] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('bonnext_transparency')) || 1.0;
    } catch {
      return 1.0;
    }
  });
  const [blurStrength, setBlurStrength] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('bonnext_blur')) || 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_transparency', String(transparency));
    } catch {
      /* empty */
    }
  }, [transparency]);
  useEffect(() => {
    try {
      localStorage.setItem('bonnext_blur', String(blurStrength));
    } catch {
      /* empty */
    }
  }, [blurStrength]);
  useEffect(() => {
    document.documentElement.style.setProperty('--bonnext-transparency', String(transparency));
    document.documentElement.style.setProperty('--bonnext-blur', `${blurStrength}px`);
  }, [transparency, blurStrength]);

  return (
    <SectionCard id="sec-window-effects" title={t('settings.windowEffects')}>
      <SettingRow label={t('settings.transparency')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
            {transparency.toFixed(1)}
          </span>
          <div style={{ flex: 1 }}>
            <Slider gradient value={transparency} min={0.7} max={1.0} step={0.05} onChange={setTransparency} />
          </div>
        </div>
      </SettingRow>
      <SettingRow label={t('settings.blurStrength')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
            {blurStrength}px
          </span>
          <div style={{ flex: 1 }}>
            <Slider gradient value={blurStrength} min={0} max={20} step={1} onChange={setBlurStrength} />
          </div>
        </div>
      </SettingRow>
    </SectionCard>
  );
}
