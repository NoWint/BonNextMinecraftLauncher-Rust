import { useTheme, type Theme, type AnimationSpeed, UI_SCALE_MIN, UI_SCALE_MAX } from '../../stores/themeStore';
import { Button, Slider } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';

export default function ThemeSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const {
    theme,
    switchThemeWithAnimation,
    uiScale,
    setUiScale,
    autoScale,
    setAutoScale,
    animationSpeed,
    setAnimationSpeed,
    animationDuration,
    setAnimationDuration,
  } = useTheme();

  return (
    <SectionCard id="sec-theme" title={t('settings.theme')}>
      <SettingRow label={t('settings.theme')}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              ['dark', t('settings.themeDark')],
              ['light', t('settings.themeLight')],
              ['oled', t('settings.themeOled')],
            ] as [Theme, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              variant={theme === val ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => switchThemeWithAnimation(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label={t('settings.uiScale')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Button variant={autoScale ? 'primary' : 'secondary'} size="sm" onClick={() => setAutoScale(!autoScale)}>
            {t('settings.autoScale')}
          </Button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 40 }}>
            {Math.round(uiScale * 100)}%
          </span>
          <div style={{ flex: 1 }}>
            <Slider
              gradient
              value={uiScale}
              min={UI_SCALE_MIN}
              max={UI_SCALE_MAX}
              step={0.05}
              onChange={(v: number) => {
                setAutoScale(false);
                setUiScale(v);
              }}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: '#555' }}>
            {Math.round(UI_SCALE_MIN * 100)}%–{Math.round(UI_SCALE_MAX * 100)}%
          </span>
        </div>
      </SettingRow>

      <SettingRow label={t('settings.animationSpeed')}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
          {(
            [
              ['fast', t('settings.animFast')],
              ['normal', t('settings.animNormal')],
              ['smooth', t('settings.animSmooth')],
              ['custom', t('settings.animCustom')],
            ] as [AnimationSpeed, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              variant={animationSpeed === val ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAnimationSpeed(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </SettingRow>

      {animationSpeed === 'custom' && (
        <SettingRow label={t('settings.animationDuration')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <input
              type="number"
              min={0.2}
              max={5.0}
              step={0.1}
              value={animationDuration}
              onChange={(e) => setAnimationDuration(Math.max(0.2, Math.min(5.0, Number(e.target.value))))}
              style={{
                width: 80,
                background: 'var(--color-panel-alt)',
                border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6em',
                padding: '4px 8px',
                outline: 'none',
                clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: 'var(--color-text-muted)' }}>
              s
            </span>
          </div>
        </SettingRow>
      )}
    </SectionCard>
  );
}
