import { useState, useEffect } from 'react';
import { Slider, Select, Button } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';

export default function SoundThemesSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [soundTheme, setSoundTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('bonnext_sound_theme') || 'cyberpunk';
    } catch {
      return 'cyberpunk';
    }
  });
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('bonnext_sound_volume')) || 50;
    } catch {
      return 50;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_sound_theme', soundTheme);
    } catch {
      /* empty */
    }
  }, [soundTheme]);
  useEffect(() => {
    try {
      localStorage.setItem('bonnext_sound_volume', String(soundVolume));
    } catch {
      /* empty */
    }
  }, [soundVolume]);

  return (
    <SectionCard id="sec-sound-themes" title={t('settings.soundThemes')}>
      <SettingRow label={t('settings.soundTheme')}>
        <div style={{ minWidth: 160 }}>
          <Select
            value={soundTheme}
            onChange={(e) => setSoundTheme(e.target.value)}
            options={[
              { value: 'cyberpunk', label: t('settings.soundThemeCyberpunk') },
              { value: 'fantasy', label: t('settings.soundThemeFantasy') },
              { value: 'minimal', label: t('settings.soundThemeMinimal') },
            ]}
          />
        </div>
      </SettingRow>
      <SettingRow label={t('settings.soundVolume')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
            {soundVolume}%
          </span>
          <div style={{ flex: 1 }}>
            <Slider gradient value={soundVolume} min={0} max={100} onChange={setSoundVolume} />
          </div>
        </div>
      </SettingRow>
      <SettingRow label={t('settings.soundTest')}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            try {
              const a = new Audio();
              a.volume = soundVolume / 100;
              a.play().catch(() => {});
            } catch {
              /* empty */
            }
          }}
        >
          {t('settings.soundTest') || 'Test'}
        </Button>
      </SettingRow>
    </SectionCard>
  );
}
