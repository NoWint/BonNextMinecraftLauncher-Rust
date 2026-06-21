import {
  useTheme,
  type Theme,
  type AnimationSpeed,
  type LayoutStyle,
  UI_SCALE_MIN,
  UI_SCALE_MAX,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from '../../../../shared/stores/themeStore';
import { Button, Slider } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';

type Density = 'compact' | 'comfortable' | 'spacious';

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
    layoutStyle,
    setLayoutStyle,
    sidebarWidth,
    setSidebarWidth,
    density,
    setDensity,
    autoDayNight,
    setAutoDayNight,
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
              onClick={() => {
                // 手动切换主题时关闭自动昼夜模式
                if (autoDayNight) setAutoDayNight(false);
                switchThemeWithAnimation(val);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label={t('settings.autoDayNight')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant={autoDayNight ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setAutoDayNight(!autoDayNight)}
          >
            {autoDayNight ? t('settings.autoDayNightOn') : t('settings.autoDayNightOff')}
          </Button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: 'var(--color-text-muted)' }}>
            {t('settings.autoDayNightHint')}
          </span>
        </div>
      </SettingRow>

      <SettingRow label={t('settings.layoutStyle')}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              ['zzz', t('settings.layoutZzz')],
              ['minimalist', t('settings.layoutMinimalist')],
            ] as [LayoutStyle, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              variant={layoutStyle === val ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setLayoutStyle(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label={t('settings.density')}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              ['compact', t('settings.densityCompact')],
              ['comfortable', t('settings.densityComfortable')],
              ['spacious', t('settings.densitySpacious')],
            ] as [Density, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              variant={density === val ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDensity(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label={t('settings.sidebarWidth')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 56 }}>
            {sidebarWidth}px
          </span>
          <div style={{ flex: 1 }}>
            <Slider
              gradient
              value={sidebarWidth}
              min={SIDEBAR_WIDTH_MIN}
              max={SIDEBAR_WIDTH_MAX}
              step={2}
              onChange={(v: number) => setSidebarWidth(v)}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: '#555' }}>
            {SIDEBAR_WIDTH_MIN}–{SIDEBAR_WIDTH_MAX}px
          </span>
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
