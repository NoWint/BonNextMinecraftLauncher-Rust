import { useState, useEffect, useMemo } from 'react';
import {
  api,
  type AppConfig,
  type LoginHistoryEntry,
  type KeyStatus,
  type SandboxAvailability,
  type HardwareProfile,
  type DiskUsage,
  type JreSourceInfo,
  type JreRelease,
  type JavaInfo,
  type YggdrasilTexturesValue,
  type StoredAccount,
} from '../api';
import { useAuth } from '../stores/authStore';
import { useConfig } from '../stores/configStore';
import { useInstances } from '../stores/instanceStore';
import { useTheme, type Theme, type AnimationSpeed, UI_SCALE_MIN, UI_SCALE_MAX } from '../stores/themeStore';
import { useI18n } from '../i18n';
import { useToast } from '../stores/toastStore';
import {
  StatusDot,
  Badge,
  Button,
  TextInput,
  Select,
  Checkbox,
  Slider,
  SettingsNav,
  resetOnboarding,
  SecurityScore,
  AuditLogViewer,
  SkinViewer3D,
} from '../components/ui';
import type { NavCategory } from '../components/ui';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './SettingsPage.module.css';

const RESOLUTION_OPTIONS = [
  { value: '854x480', label: '854 × 480' },
  { value: '1280x720', label: '1280 × 720' },
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '2560x1440', label: '2560 × 1440' },
  { value: '3840x2160', label: '3840 × 2160' },
];

function SectionCard({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
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

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingRow__label}>{label}</span>
      {children}
    </div>
  );
}

function getSuitabilityBadge(
  t: (key: string) => string,
  suitableFor: string,
): { label: string; variant: 'success' | 'warning' | 'danger' } {
  switch (suitableFor) {
    case 'recommended':
      return { label: t('settings.recommended'), variant: 'success' };
    case 'optional':
      return { label: t('settings.optional'), variant: 'warning' };
    default:
      return { label: t('settings.notRecommended'), variant: 'danger' };
  }
}

function MemorySection({
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

  useEffect(() => {
    setMemoryGB(Math.round(localConfig.max_memory / 1024));
  }, [localConfig.max_memory]);

  return (
    <SectionCard id="sec-memory" title={t('settings.memory')}>
      <SettingRow label={t('settings.allocatedMemory')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
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
                onConfigChange({ max_memory: val * 1024 });
              }}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: '#555' }}>
            {memoryGB} {t('common.unit.gb')}
          </span>
        </div>
      </SettingRow>

      <SettingRow label={t('settings.forceMemory')}>
        <label className={styles.checkboxLabel}>
          <Checkbox
            on={localConfig.force_memory || false}
            onChange={() => onConfigChange({ force_memory: !localConfig.force_memory })}
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
              onConfigChange({ window_width: w, window_height: h });
            }}
            options={RESOLUTION_OPTIONS}
          />
        </div>
      </SettingRow>
    </SectionCard>
  );
}

function ThemeSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const {
    theme,
    switchThemeWithAnimation,
    uiScale,
    setUiScale,
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 40 }}>
            {Math.round(uiScale * 100)}%
          </span>
          <div style={{ flex: 1 }}>
            <Slider gradient value={uiScale} min={UI_SCALE_MIN} max={UI_SCALE_MAX} step={0.05} onChange={setUiScale} />
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

function FontCustomizationSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
    }
  }, [fontWeight]);
  useEffect(() => {
    try {
      localStorage.setItem('bonnext_font_line_height', String(fontLineHeight));
    } catch {
      /* noop */
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

function WindowEffectsSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
    }
  }, [transparency]);
  useEffect(() => {
    try {
      localStorage.setItem('bonnext_blur', String(blurStrength));
    } catch {
      /* noop */
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

function SoundThemesSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
    }
  }, [soundTheme]);
  useEffect(() => {
    try {
      localStorage.setItem('bonnext_sound_volume', String(soundVolume));
    } catch {
      /* noop */
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
              /* noop */
            }
          }}
        >
          {t('settings.soundTest') || 'Test'}
        </Button>
      </SettingRow>
    </SectionCard>
  );
}

function DynamicBgSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
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

function DownloadSection({
  t,
  addToast,
}: {
  t: (key: string, params?: Record<string, string>) => string;
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}) {
  const [downloadConfig, setDownloadConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('bonnext_download_config');
      return saved ? JSON.parse(saved) : { maxSpeed: 0, pauseDuringGame: true, priority: 'normal' };
    } catch {
      return { maxSpeed: 0, pauseDuringGame: true, priority: 'normal' };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_download_config', JSON.stringify(downloadConfig));
    } catch {
      /* noop */
    }
  }, [downloadConfig]);

  const handleSaveDownloadConfig = async () => {
    try {
      await api.setDownloadScheduleConfig({
        max_speed_bytes: downloadConfig.maxSpeed * 1_048_576,
        active_during_game: !downloadConfig.pauseDuringGame,
        priority: downloadConfig.priority,
      });
      addToast({ type: 'success', title: t('settings.saved') || 'Saved' });
    } catch (e) {
      addToast({ type: 'error', title: t('settings.saveFailed') || 'Save failed', message: String(e) });
    }
  };

  return (
    <SectionCard id="sec-download" title={t('settings.download')}>
      <SettingRow label={t('settings.downloadSpeed')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <input
            type="number"
            min={0}
            step={0.5}
            value={downloadConfig.maxSpeed}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value));
              setDownloadConfig({ ...downloadConfig, maxSpeed: val });
            }}
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
            {downloadConfig.maxSpeed === 0 ? t('settings.downloadUnlimited') : 'MB/s'}
          </span>
        </div>
      </SettingRow>
      <SettingRow label={t('settings.downloadPauseDuringGame')}>
        <label className={styles.checkboxLabel}>
          <Checkbox
            on={downloadConfig.pauseDuringGame}
            onChange={() => setDownloadConfig({ ...downloadConfig, pauseDuringGame: !downloadConfig.pauseDuringGame })}
          />
          <span
            className={
              downloadConfig.pauseDuringGame ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']
            }
          >
            {t('settings.downloadPauseDuringGame')}
          </span>
        </label>
      </SettingRow>
      <SettingRow label={t('settings.downloadPriority')}>
        <div style={{ minWidth: 160 }}>
          <Select
            value={downloadConfig.priority}
            onChange={(e) => {
              const next = { ...downloadConfig, priority: e.target.value };
              setDownloadConfig(next);
            }}
            options={[
              { value: 'low', label: t('settings.downloadPriorityLow') },
              { value: 'normal', label: t('settings.downloadPriorityNormal') },
              { value: 'high', label: t('settings.downloadPriorityHigh') },
            ]}
          />
        </div>
      </SettingRow>
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={handleSaveDownloadConfig}>
          {t('common.save')}
        </Button>
      </div>
    </SectionCard>
  );
}

function AccessibilitySection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
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

function MiniModeSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
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

function DiscordSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(() => {
    try {
      return localStorage.getItem('bonnext_discord_rpc') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_discord_rpc', String(discordRpcEnabled));
    } catch {
      /* noop */
    }
  }, [discordRpcEnabled]);

  const handleDiscordRpcToggle = async () => {
    const next = !discordRpcEnabled;
    setDiscordRpcEnabled(next);
    try {
      if (next) {
        await api.startDiscordRpc();
      } else {
        await api.stopDiscordRpc();
      }
    } catch {
      /* noop */
    }
  };

  return (
    <SectionCard id="sec-discord" title={t('settings.discord')}>
      <SettingRow label={t('settings.discordRpc')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <label className={styles.checkboxLabel}>
            <Checkbox on={discordRpcEnabled} onChange={handleDiscordRpcToggle} />
            <span className={styles.checkboxLabel__text}>
              {discordRpcEnabled ? t('settings.discordEnabled') : t('settings.discordDisabled')}
            </span>
          </label>
          <span style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', marginLeft: 8 }}>
            {t('settings.discordDesc')}
          </span>
        </div>
      </SettingRow>
    </SectionCard>
  );
}

function BatterySection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
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
      /* noop */
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

function SkinStationSection({
  addToast,
}: {
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}) {
  const { t } = useI18n();
  const { state: authState, yggdrasilLogin, refreshAccounts } = useAuth();
  const [presets, setPresets] = useState<[string, string][]>([]);
  const [selectedPreset, setSelectedPreset] = useState('https://littleskin.cn/api/yggdrasil');
  const [customUrl, setCustomUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeAccount, setActiveAccount] = useState<StoredAccount | null>(null);
  const [yggdrasilAccount, setYggdrasilAccount] = useState<StoredAccount | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [localSkinUrl, setLocalSkinUrl] = useState<string | null>(null);
  const [capeUrl, setCapeUrl] = useState<string | null>(null);
  const [skinModel, setSkinModel] = useState<'default' | 'slim'>('default');
  const [uploading, setUploading] = useState(false);
  const [authlibStatus, setAuthlibStatus] = useState<'idle' | 'downloading' | 'ready'>('idle');

  const serverUrl = selectedPreset === '' ? customUrl : selectedPreset;

  useEffect(() => {
    api
      .getYggdrasilPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const acct = authState.accounts.find((a) => a.id === authState.activeAccountId) || null;
    setActiveAccount(acct);
    const ygg = authState.accounts.find((a) => a.account_type === 'yggdrasil') || null;
    setYggdrasilAccount(ygg);
  }, [authState.accounts, authState.activeAccountId]);

  useEffect(() => {
    if (activeAccount?.local_skin_path) {
      api
        .readSkinFile(activeAccount.local_skin_path)
        .then((b64) => {
          setLocalSkinUrl(`data:image/png;base64,${b64}`);
        })
        .catch(() => {
          setLocalSkinUrl(null);
        });
      if (activeAccount.local_skin_model === 'slim') {
        setSkinModel('slim');
      }
    } else {
      setLocalSkinUrl(null);
    }
  }, [activeAccount?.local_skin_path, activeAccount?.local_skin_model]);

  useEffect(() => {
    if (!yggdrasilAccount?.uuid || !yggdrasilAccount?.yggdrasil_server_url || !yggdrasilAccount?.access_token) {
      setSkinUrl(null);
      setCapeUrl(null);
      return;
    }
    api
      .yggdrasilGetProfile(yggdrasilAccount.uuid, yggdrasilAccount.yggdrasil_server_url, yggdrasilAccount.access_token)
      .then((profile) => {
        const texturesProp = profile.properties.find((p) => p.name === 'textures');
        if (texturesProp) {
          try {
            const decoded: YggdrasilTexturesValue = JSON.parse(atob(texturesProp.value));
            if (decoded.textures.SKIN?.url) {
              setSkinUrl(decoded.textures.SKIN.url);
            }
            if (decoded.textures.SKIN?.metadata?.model === 'slim') {
              setSkinModel('slim');
            }
            if (decoded.textures.CAPE?.url) {
              setCapeUrl(decoded.textures.CAPE.url);
            }
          } catch {
            console.warn('Failed to decode skin textures');
          }
        }
      })
      .catch((e) => {
        console.warn('Failed to fetch skin profile:', e);
      });
  }, [yggdrasilAccount]);

  const handleLogin = async () => {
    if (!serverUrl || !email || !password) {
      setLoginError(t('skinStation.fillAllFields'));
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const result = await yggdrasilLogin(serverUrl, email, password);
      addToast({
        type: 'success',
        title: t('skinStation.loginSuccess'),
        message: t('skinStation.welcome', { name: result.username }),
      });
      setPassword('');
      await refreshAccounts();
    } catch (e: any) {
      const raw = e?.toString?.() || '';
      let msg = raw;
      if (raw.includes('ForbiddenOperationException')) msg = t('skinStation.errorWrongPassword');
      else if (raw.includes('RateLimitedException')) msg = t('skinStation.errorRateLimited');
      else if (raw.includes('ResourceNotFoundException')) msg = t('skinStation.errorServerNotFound');
      else if (raw.includes('Invalid email or password')) msg = t('skinStation.errorWrongPassword');
      else if (raw.includes('Session expired')) msg = t('skinStation.errorSessionExpired');
      else if (raw.includes('No game profile')) msg = t('skinStation.errorNoProfile');
      else if (raw.includes('connection') || raw.includes('timeout') || raw.includes('network'))
        msg = t('skinStation.errorNetwork');
      else if (raw.includes('Authentication failed')) msg = raw.replace('Authentication failed: ', '');
      setLoginError(msg || t('skinStation.loginFailed'));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleUploadSkin = async () => {
    if (!yggdrasilAccount) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Skin Image', extensions: ['png'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      setUploading(true);
      await api.yggdrasilUploadSkin(
        yggdrasilAccount.uuid,
        yggdrasilAccount.yggdrasil_server_url!,
        yggdrasilAccount.access_token,
        selected,
        skinModel,
      );
      addToast({ type: 'success', title: t('skinStation.uploadSuccess') });
      await refreshAccounts();
    } catch (e: any) {
      addToast({ type: 'error', title: t('skinStation.uploadFailed'), message: e?.toString?.() });
    } finally {
      setUploading(false);
    }
  };

  const handleResetSkin = async () => {
    if (!yggdrasilAccount) return;
    try {
      await api.yggdrasilResetSkin(
        yggdrasilAccount.uuid,
        yggdrasilAccount.yggdrasil_server_url!,
        yggdrasilAccount.access_token,
      );
      addToast({ type: 'success', title: t('skinStation.resetSuccess') });
      setSkinUrl(null);
      setCapeUrl(null);
    } catch (e: any) {
      addToast({ type: 'error', title: t('skinStation.resetFailed'), message: e?.toString?.() });
    }
  };

  const handleSelectLocalSkin = async () => {
    if (!activeAccount) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Skin Image', extensions: ['png'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      try {
        await api.setLocalSkin(activeAccount.id, selected, skinModel);
      } catch (e: any) {
        addToast({ type: 'error', title: '保存失败', message: e?.toString?.() });
        return;
      }
      addToast({ type: 'success', title: t('skinStation.localSkinSet') });

      try {
        await refreshAccounts();
      } catch {
        /* noop */
      }

      try {
        const b64 = await api.readSkinFile(selected);
        setLocalSkinUrl(`data:image/png;base64,${b64}`);
      } catch (e: any) {
        setLocalSkinUrl(null);
      }
    } catch (e: any) {
      addToast({ type: 'error', title: t('skinStation.setFailed'), message: e?.toString?.() });
    }
  };

  const handleClearLocalSkin = async () => {
    if (!activeAccount) return;
    try {
      await api.setLocalSkin(activeAccount.id, null, null);
      setLocalSkinUrl(null);
      addToast({ type: 'success', title: t('skinStation.localSkinCleared') });
      await refreshAccounts();
    } catch (e: any) {
      addToast({ type: 'error', title: t('skinStation.clearFailed'), message: e?.toString?.() });
    }
  };

  const handleEnsureAuthlib = async () => {
    setAuthlibStatus('downloading');
    try {
      await api.ensureAuthlibInjector();
      setAuthlibStatus('ready');
      addToast({ type: 'success', title: t('skinStation.authlibReadyToast') });
    } catch (e: any) {
      setAuthlibStatus('idle');
      addToast({ type: 'error', title: t('skinStation.downloadFailed'), message: e?.toString?.() });
    }
  };

  const previewSkinUrl = localSkinUrl || skinUrl;

  return (
    <SectionCard id="sec-skin-station" title={t('skinStation.title')}>
      <div className={styles.skinLayout}>
        <div className={styles.skinPreview}>
          <SkinViewer3D
            skinUrl={previewSkinUrl}
            capeUrl={capeUrl}
            model={skinModel === 'slim' ? 'slim' : 'default'}
            width={140}
            height={210}
          />
          <div className={styles.skinPreview__label}>
            {previewSkinUrl ? t('skinStation.skinPreview') : t('skinStation.noSkin')}
          </div>
        </div>

        <div className={styles.skinControls}>
          {!yggdrasilAccount && (
            <div className={styles.skinLoginSection}>
              <div className={styles.skinSubTitle}>{t('skinStation.onlineLogin')}</div>
              <div className={styles.skinDesc}>{t('skinStation.desc')}</div>
              <SettingRow label={t('skinStation.server')}>
                <div style={{ flex: 1 }}>
                  <Select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    options={presets.map(([name, url]) => ({ value: url, label: name }))}
                  />
                  {selectedPreset === '' && (
                    <div style={{ marginTop: 6 }}>
                      <TextInput
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://example.com/api/yggdrasil"
                      />
                    </div>
                  )}
                </div>
              </SettingRow>
              <SettingRow label={t('skinStation.email')}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </SettingRow>
              <SettingRow label={t('skinStation.password')}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLogin();
                    }}
                  />
                </div>
              </SettingRow>
              {loginError && <div className={styles.skinError}>{loginError}</div>}
              <div className={styles.actions}>
                <Button variant="primary" size="sm" disabled={loggingIn} onClick={handleLogin}>
                  {loggingIn ? t('skinStation.loggingIn') : t('skinStation.loginBtn')}
                </Button>
              </div>
            </div>
          )}

          {yggdrasilAccount && (
            <>
              <div className={styles.accountRow}>
                <StatusDot status="ready" />
                <span className={styles.accountName}>{yggdrasilAccount.username}</span>
                <Badge variant="accent">YGGDRASIL</Badge>
                {yggdrasilAccount.yggdrasil_server_url && (
                  <span style={{ fontSize: '0.42em', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                    {yggdrasilAccount.yggdrasil_server_url.replace(/https?:\/\//, '').replace(/\/api\/yggdrasil.*/, '')}
                  </span>
                )}
              </div>

              {yggdrasilAccount.yggdrasil_selected_profile && (
                <SettingRow label={t('skinStation.currentProfile')}>
                  <span
                    style={{ fontSize: '0.5em', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}
                  >
                    {yggdrasilAccount.yggdrasil_selected_profile}
                  </span>
                </SettingRow>
              )}

              <SettingRow label={t('skinStation.skinModel')}>
                <div className={styles.skinModelToggle}>
                  <Button
                    variant={skinModel === 'default' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSkinModel('default')}
                  >
                    {t('skinStation.classic')}
                  </Button>
                  <Button
                    variant={skinModel === 'slim' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSkinModel('slim')}
                  >
                    {t('skinStation.slim')}
                  </Button>
                </div>
              </SettingRow>

              <div className={styles.actions}>
                <Button variant="primary" size="sm" disabled={uploading} onClick={handleUploadSkin}>
                  {uploading ? t('skinStation.uploading') : t('skinStation.uploadSkin')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleResetSkin}>
                  {t('skinStation.resetSkin')}
                </Button>
              </div>

              {capeUrl && (
                <div className={styles.skinCapeHint}>
                  <span className={styles.skinCapeHint__dot} />
                  {t('skinStation.cape')}: {capeUrl.split('/').pop()}
                </div>
              )}

              <div className={styles.skinAuthlibRow}>
                <StatusDot status={authlibStatus === 'ready' ? 'ready' : 'inactive'} />
                <span className={styles.skinAuthlibLabel}>
                  authlib-injector:{' '}
                  {authlibStatus === 'ready'
                    ? t('skinStation.authlibReady')
                    : authlibStatus === 'downloading'
                      ? t('skinStation.authlibDownloading')
                      : t('skinStation.authlibNotDownloaded')}
                </span>
                {authlibStatus !== 'ready' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleEnsureAuthlib}
                    disabled={authlibStatus === 'downloading'}
                  >
                    {t('skinStation.download')}
                  </Button>
                )}
              </div>
            </>
          )}

          {activeAccount && activeAccount.account_type !== 'yggdrasil' && (
            <>
              <hr className={styles.skinDivider} />
              <div className={styles.skinSubTitle}>{t('skinStation.localSkin')}</div>
              <div className={styles.skinDesc}>
                {t('skinStation.localSkinDesc', {
                  type:
                    activeAccount.account_type === 'offline'
                      ? t('skinStation.localSkinOffline')
                      : t('skinStation.localSkinMicrosoft'),
                })}
              </div>
              <SettingRow label={t('skinStation.skinModel')}>
                <div className={styles.skinModelToggle}>
                  <Button
                    variant={skinModel === 'default' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSkinModel('default')}
                  >
                    {t('skinStation.classic')}
                  </Button>
                  <Button
                    variant={skinModel === 'slim' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSkinModel('slim')}
                  >
                    {t('skinStation.slim')}
                  </Button>
                </div>
              </SettingRow>
              <div className={styles.actions}>
                <Button variant="primary" size="sm" onClick={handleSelectLocalSkin}>
                  {t('skinStation.selectLocalSkin')}
                </Button>
                {activeAccount.local_skin_path && (
                  <Button variant="secondary" size="sm" onClick={handleClearLocalSkin}>
                    {t('skinStation.clearSkin')}
                  </Button>
                )}
              </div>
              {activeAccount.local_skin_path && (
                <div className={styles.skinFileHint}>
                  <span className={styles.skinFileHint__icon}>&#9670;</span>
                  {activeAccount.local_skin_path.split(/[/\\]/).pop()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { state: authState, logout, switchAccount } = useAuth();
  const { state: cfgState, saveConfig } = useConfig();
  const {
    state: { instances },
  } = useInstances();
  const { t, lang, setLang } = useI18n();
  const { addToast } = useToast();
  const auth = authState.currentUser;
  const config = cfgState.config;
  const [localConfig, setLocalConfig] = useState<AppConfig | null>(config);
  const [javaList, setJavaList] = useState<JavaInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [jreSources, setJreSources] = useState<JreSourceInfo[]>([]);
  const [jreDownloadVersion, setJreDownloadVersion] = useState<number>(21);
  const [jreAvailableVersions, setJreAvailableVersions] = useState<JreRelease[]>([]);
  const [jreDownloading, setJreDownloading] = useState(false);
  const [jreDownloadProgress, setJreDownloadProgress] = useState<{ downloaded: number; total: number } | null>(null);
  const [downloadedJres, setDownloadedJres] = useState<number[]>([]);
  const [gcRecs, setGcRecs] = useState<
    Array<{
      gc_type: string;
      heap_size_mb: number;
      metaspace_mb: number;
      jvm_args: string[];
      description: string;
      suitable_for: string;
      reason: string;
    }>
  >([]);
  const [gcCopied, setGcCopied] = useState<Record<string, boolean>>({});
  const [screenshotInstanceId, setScreenshotInstanceId] = useState<string>('');
  const [screenshots, setScreenshots] = useState<
    Array<{ filename: string; path: string; size_bytes: number; modified: string }>
  >([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [installedVersions, setInstalledVersions] = useState<
    Array<{ version_id: string; size_bytes: number; version_type: string; path: string }>
  >([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [fileManagementGameDir, setFileManagementGameDir] = useState<string>('');
  const [securityScore, setSecurityScore] = useState(40);
  const [encryptionStatus, setEncryptionStatus] = useState<{ encrypted: boolean; plain: boolean }>({
    encrypted: false,
    plain: false,
  });
  const [cfKeyStatus, setCfKeyStatus] = useState<KeyStatus | null>(null);
  const [sandboxInfo, setSandboxInfo] = useState<SandboxAvailability | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [cfKeyValue, setCfKeyValue] = useState('');
  const [showCfKey, setShowCfKey] = useState(false);

  useEffect(() => {
    if (config) setLocalConfig(config);
    api
      .findAllJava()
      .then(setJavaList)
      .catch(() => {});
    api
      .getJreSources()
      .then(setJreSources)
      .catch(() => {});
    api
      .listDownloadedJres()
      .then(setDownloadedJres)
      .catch(() => {});
  }, [config]);

  useEffect(() => {
    api
      .getHardwareProfile()
      .then(setHardwareProfile)
      .catch(() => {});
    api
      .getDiskUsage()
      .then(setDiskUsage)
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getGameDir()
      .then(setFileManagementGameDir)
      .catch(() => {});
    setVersionsLoading(true);
    api
      .listInstalledVersions()
      .then(setInstalledVersions)
      .catch(() => setInstalledVersions([]))
      .finally(() => setVersionsLoading(false));
  }, []);

  useEffect(() => {
    api
      .getSecurityScore()
      .then(setSecurityScore)
      .catch(() => {});
    api
      .getEncryptionStatus()
      .then(setEncryptionStatus)
      .catch(() => {});
    api
      .getApiKeyStatus('cf_api_key')
      .then(setCfKeyStatus)
      .catch(() => {});
    api
      .getSandboxAvailability()
      .then(setSandboxInfo)
      .catch(() => {});
    api
      .getLoginHistory()
      .then(setLoginHistory)
      .catch(() => {});
  }, []);

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm(t('settings.fileMgmt.deleteConfirm', { version: versionId }))) return;
    setDeletingVersion(versionId);
    try {
      await api.deleteVersion(versionId);
      setInstalledVersions((prev) => prev.filter((v) => v.version_id !== versionId));
      api
        .getDiskUsage()
        .then(setDiskUsage)
        .catch(() => {});
    } catch (e: any) {
      alert(e?.toString() || t('settings.fileMgmt.deleteFailed'));
    } finally {
      setDeletingVersion(null);
    }
  };

  useEffect(() => {
    const unlisten = api.onJreDownloadProgress((p) => {
      setJreDownloadProgress({ downloaded: p.downloaded, total: p.total });
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const handleFetchJreVersions = async (version: number) => {
    setJreDownloadVersion(version);
    try {
      const releases = await api.fetchAvailableJreVersions(version);
      setJreAvailableVersions(releases);
    } catch {
      setJreAvailableVersions([]);
    }
  };

  const handleDownloadJre = async () => {
    if (jreDownloading) return;
    setJreDownloading(true);
    setJreDownloadProgress(null);
    try {
      const source = localConfig?.java_download_source || 'adoptium';
      await api.downloadJavaVersion(jreDownloadVersion, source);
      addToast({ type: 'success', title: `Java ${jreDownloadVersion} downloaded` });
      api
        .listDownloadedJres()
        .then(setDownloadedJres)
        .catch(() => {});
      api
        .findAllJava()
        .then(setJavaList)
        .catch(() => {});
    } catch (e: any) {
      addToast({ type: 'error', title: 'Download failed', message: e?.toString() });
    } finally {
      setJreDownloading(false);
      setJreDownloadProgress(null);
    }
  };

  useEffect(() => {
    const instId = instances.length > 0 ? instances[0].id : '';
    if (instId) {
      api
        .getGcRecommendations(instId)
        .then(setGcRecs)
        .catch(() => {});
    }
  }, [instances]);

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setError('');
    try {
      await saveConfig(localConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.toString() || 'Save failed');
    }
    setSaving(false);
  };

  const handleBrowseJava = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Java', extensions: ['exe', 'bin', '', '*'] }],
      });
      if (selected && typeof selected === 'string') {
        setLocalConfig((prev) => (prev ? { ...prev, java_path: selected } : prev));
      }
    } catch {
      /* dialog cancelled */
    }
  };

  const handleCopyGcArgs = async (gcType: string, args: string[]) => {
    try {
      await navigator.clipboard.writeText(args.join(' '));
      setGcCopied((prev) => ({ ...prev, [gcType]: true }));
      setTimeout(() => setGcCopied((prev) => ({ ...prev, [gcType]: false })), 2000);
    } catch {
      /* clipboard fail */
    }
  };

  const handleBrowseGameDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setLocalConfig((prev) => (prev ? { ...prev, game_dir: selected } : prev));
      }
    } catch {
      /* dialog cancelled */
    }
  };

  const handleConfigChange = (updates: Partial<AppConfig>) => {
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if (updates.security && prev.security) {
        next.security = { ...prev.security, ...updates.security };
      }
      return next;
    });
  };

  if (!localConfig || !auth)
    return (
      <div style={{ color: '#555', fontSize: '0.7em', padding: 40, textAlign: 'center' }}>{t('common.loading')}</div>
    );

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  };

  const navCategories: NavCategory[] = useMemo(
    () => [
      {
        id: 'general',
        label: t('settings.nav.general'),
        sectionIds: ['sec-account', 'sec-skin-station', 'sec-language', 'sec-theme', 'sec-font-custom', 'sec-guide'],
      },
      {
        id: 'performance',
        label: t('settings.nav.performance'),
        sectionIds: ['sec-java', 'sec-memory', 'sec-gc-tuning', 'sec-disk-usage', 'sec-file-mgmt'],
      },
      {
        id: 'launch',
        label: t('settings.nav.launch'),
        sectionIds: ['sec-launch-behavior', 'sec-data-dir'],
      },
      {
        id: 'appearance',
        label: t('settings.nav.appearance'),
        sectionIds: ['sec-dynamic-bg', 'sec-sound-themes', 'sec-window-effects', 'sec-mini-mode'],
      },
      {
        id: 'system',
        label: t('settings.nav.system'),
        sectionIds: ['sec-hardware', 'sec-battery', 'sec-download'],
      },
      {
        id: 'social',
        label: t('settings.nav.social'),
        sectionIds: ['sec-discord', 'sec-accessibility', 'sec-screenshots'],
      },
      {
        id: 'security',
        label: '安全',
        sectionIds: [
          'sec-security-overview',
          'sec-credential-protection',
          'sec-network-security',
          'sec-launch-security',
          'sec-api-key-management',
          'sec-security-audit',
        ],
      },
    ],
    [t],
  );

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => setLocalConfig(config)}>
            {t('settings.reset')}
          </Button>
          <Button variant="primary" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? t('settings.saving') : saved ? '✓ ' + t('settings.saved') : t('settings.save')}
          </Button>
        </div>
      </div>

      <SettingsNav categories={navCategories} />

      <SectionCard id="sec-account" title={t('settings.account')}>
        <div className={styles.accountRow}>
          <StatusDot status="ready" />
          <span className={styles.accountName}>{auth.username}</span>
          <Badge variant="default">
            {authState.accounts.find((a) => a.id === authState.activeAccountId)?.account_type?.toUpperCase() ||
              'OFFLINE'}
          </Badge>
          <div style={{ marginLeft: 'auto' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
            >
              {t('settings.logout')}
            </Button>
          </div>
        </div>

        {authState.accounts.length > 1 && (
          <div className={styles.switchAccounts}>
            <div className={styles.switchAccounts__label}>{t('settings.switchAccount')}</div>
            <div className={styles.switchAccounts__list}>
              {authState.accounts.map((acct) => (
                <Button
                  key={acct.id}
                  variant={acct.id === authState.activeAccountId ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => switchAccount(acct.id)}
                >
                  {acct.username}
                </Button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SkinStationSection addToast={addToast} />

      <SectionCard id="sec-java" title={t('settings.java')}>
        <SettingRow label={t('settings.javaVersion')}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
              <label
                className={styles.checkboxLabel}
                style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)' }}
                onClick={() => setLocalConfig({ ...localConfig, java_path: null })}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    color: !localConfig.java_path ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      flexShrink: 0,
                      border: `2px solid ${!localConfig.java_path ? 'var(--color-accent)' : 'var(--color-border-mid)'}`,
                      background: !localConfig.java_path ? 'var(--color-accent)' : 'transparent',
                    }}
                  />
                  <span style={{ fontSize: '0.65em' }}>{t('instanceDetail.autoDetect')}</span>
                </div>
              </label>
              {javaList.map((java) => (
                <label
                  key={java.path}
                  className={styles.checkboxLabel}
                  style={{ padding: '4px 8px', cursor: 'pointer' }}
                  onClick={() => setLocalConfig({ ...localConfig, java_path: java.path })}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      color:
                        localConfig.java_path === java.path ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        flexShrink: 0,
                        border: `2px solid ${localConfig.java_path === java.path ? 'var(--color-accent)' : 'var(--color-border-mid)'}`,
                        background: localConfig.java_path === java.path ? 'var(--color-accent)' : 'transparent',
                      }}
                    />
                    <span
                      style={{ fontSize: '0.6em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {java.path.split(/[/\\]/).slice(-2).join('/')}
                    </span>
                    {java.version !== null && <Badge variant="accent">Java {java.version}</Badge>}
                    {java.vendor && (
                      <span style={{ fontSize: '0.5em', color: 'var(--color-text-dim)' }}>{java.vendor}</span>
                    )}
                  </div>
                </label>
              ))}
              {localConfig.java_path &&
                !javaList.some((j) => j.path === localConfig.java_path) &&
                config?.java_path === localConfig.java_path && (
                  <label
                    className={styles.checkboxLabel}
                    style={{ padding: '4px 8px', cursor: 'pointer' }}
                    onClick={() => setLocalConfig({ ...localConfig, java_path: config?.java_path || null })}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flex: 1,
                        color:
                          localConfig.java_path === config?.java_path
                            ? 'var(--color-accent)'
                            : 'var(--color-text-secondary)',
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          flexShrink: 0,
                          border: `2px solid ${localConfig.java_path === config?.java_path ? 'var(--color-accent)' : 'var(--color-border-mid)'}`,
                          background:
                            localConfig.java_path === config?.java_path ? 'var(--color-accent)' : 'transparent',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.6em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {localConfig.java_path.split(/[/\\]/).slice(-2).join('/')}
                      </span>
                      <Badge variant="default">{t('settings.saved')}</Badge>
                    </div>
                  </label>
                )}
            </div>
          </div>
        </SettingRow>
        <SettingRow label={t('settings.browse')}>
          <Button variant="secondary" size="sm" onClick={handleBrowseJava}>
            {t('settings.browse')}
          </Button>
        </SettingRow>

        <SettingRow label={t('settings.forceJavaPath')}>
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.force_java_path || false}
              onChange={() => setLocalConfig({ ...localConfig, force_java_path: !localConfig.force_java_path })}
            />
            <span
              className={
                localConfig.force_java_path ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']
              }
            >
              {t('settings.forceJavaPathDesc')}
            </span>
          </label>
        </SettingRow>

        <SettingRow label={t('settings.javaDownloadSource')}>
          <div style={{ minWidth: 180 }}>
            <Select
              value={localConfig.java_download_source || 'adoptium'}
              onChange={(e) => setLocalConfig({ ...localConfig, java_download_source: e.target.value })}
              options={(jreSources.length > 0
                ? jreSources
                : [
                    { id: 'adoptium', label: 'Eclipse Adoptium (HotSpot)', available: true },
                    { id: 'zulu', label: 'Azul Zulu', available: true },
                    { id: 'microsoft', label: 'Microsoft OpenJDK', available: true },
                    { id: 'corretto', label: 'Amazon Corretto', available: true },
                  ]
              ).map((s) => ({
                value: s.id,
                label: s.label + (s.available ? '' : ` (${t('common.unavailable') || 'Unavailable'})`),
              }))}
            />
          </div>
        </SettingRow>

        <SettingRow label={t('settings.downloadJavaVersion') || 'Download Java Version'}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {[8, 11, 17, 21, 22, 23, 24].map((v) => (
                <button
                  key={v}
                  onClick={() => handleFetchJreVersions(v)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.6em',
                    fontWeight: jreDownloadVersion === v ? 700 : 500,
                    fontFamily: 'var(--font-mono)',
                    color:
                      jreDownloadVersion === v
                        ? 'var(--color-bg)'
                        : downloadedJres.includes(v)
                          ? 'var(--color-accent)'
                          : 'var(--color-text-secondary)',
                    background: jreDownloadVersion === v ? 'var(--color-accent)' : 'var(--color-panel-alt)',
                    border: `1px solid ${jreDownloadVersion === v ? 'var(--color-accent)' : downloadedJres.includes(v) ? 'var(--color-accent-30)' : 'var(--color-border-light)'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    letterSpacing: 0.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Java {v}
                  {downloadedJres.includes(v) ? ' ✓' : ''}
                </button>
              ))}
            </div>
            {jreAvailableVersions.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.55em', color: 'var(--color-text-muted)' }}>
                {jreAvailableVersions.length} release{jreAvailableVersions.length !== 1 ? 's' : ''} available (
                {jreAvailableVersions[0]?.size_mb.toFixed(0)} MB)
              </div>
            )}
            {jreDownloading && jreDownloadProgress && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{ height: 4, background: 'var(--color-border-light)', borderRadius: 2, overflow: 'hidden' }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${jreDownloadProgress.total > 0 ? (jreDownloadProgress.downloaded / jreDownloadProgress.total) * 100 : 0}%`,
                      background: 'var(--color-accent)',
                      borderRadius: 2,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: '0.5em',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {(jreDownloadProgress.downloaded / 1_048_576).toFixed(1)} MB /{' '}
                  {(jreDownloadProgress.total / 1_048_576).toFixed(1)} MB
                </div>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Button variant="primary" size="sm" onClick={handleDownloadJre} disabled={jreDownloading}>
                {jreDownloading
                  ? t('common.loading') || 'Downloading...'
                  : t('settings.downloadJava') || `Download Java ${jreDownloadVersion}`}
              </Button>
            </div>
          </div>
        </SettingRow>

        <SettingRow label={t('settings.jvmArgs')}>
          <div style={{ flex: 1 }}>
            <TextInput
              value={localConfig.jvm_args || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, jvm_args: e.target.value || null })}
              placeholder="-Xmx4G -XX:+UseG1GC -XX:+ParallelRefProcEnabled"
            />
          </div>
        </SettingRow>
      </SectionCard>

      <MemorySection
        localConfig={localConfig}
        onConfigChange={handleConfigChange}
        t={t}
        hardwareProfile={hardwareProfile}
      />

      <SectionCard id="sec-launch-behavior" title={t('settings.launchBehavior')}>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.keep_launcher_open}
              onChange={() => setLocalConfig({ ...localConfig, keep_launcher_open: !localConfig.keep_launcher_open })}
            />
            <span className={styles.checkboxLabel__text}>{t('settings.keepOpen')}</span>
          </label>
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={!localConfig.keep_launcher_open}
              onChange={() => setLocalConfig({ ...localConfig, keep_launcher_open: !localConfig.keep_launcher_open })}
            />
            <span
              className={
                !localConfig.keep_launcher_open ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']
              }
            >
              {t('settings.autoClose')}
            </span>
          </label>
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.show_log_on_crash}
              onChange={() => setLocalConfig({ ...localConfig, show_log_on_crash: !localConfig.show_log_on_crash })}
            />
            <span className={styles.checkboxLabel__text}>{t('settings.showLog')}</span>
          </label>
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.auto_update_java}
              onChange={() => setLocalConfig({ ...localConfig, auto_update_java: !localConfig.auto_update_java })}
            />
            <span
              className={
                localConfig.auto_update_java ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']
              }
            >
              {t('settings.autoUpdateJava')}
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard id="sec-data-dir" title={t('settings.dataDir')}>
        <SettingRow label={t('settings.instancePath')}>
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            <div style={{ flex: 1 }}>
              <TextInput
                value={localConfig.game_dir || ''}
                onChange={(e) => setLocalConfig({ ...localConfig, game_dir: e.target.value || null })}
                placeholder="~/BonNext/instances/"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleBrowseGameDir}>
              {t('settings.browse')}
            </Button>
          </div>
        </SettingRow>
      </SectionCard>

      <ThemeSection t={t} />

      <SectionCard id="sec-language" title={t('settings.languageSectionTitle')}>
        <SettingRow label={t('settings.language')}>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant={lang === 'zh-CN' ? 'primary' : 'secondary'} size="sm" onClick={() => setLang('zh-CN')}>
              {t('settings.chinese')}
            </Button>
            <Button variant={lang === 'en-US' ? 'primary' : 'secondary'} size="sm" onClick={() => setLang('en-US')}>
              {t('settings.english')}
            </Button>
          </div>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-guide" title={t('settings.guide') || 'Guide'}>
        <SettingRow label={t('settings.guideDesc') || 'Re-open the first-time setup guide'}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetOnboarding();
              window.location.hash = '#/home';
            }}
          >
            {t('settings.reopenGuide') || 'Re-open Guide'}
          </Button>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-hardware" title={t('settings.hardwareProfile')}>
        {hardwareProfile ? (
          <div className={styles.hwGrid}>
            <div className={styles.hwItem}>
              <span className={styles.hwItem__label}>{t('settings.cpu')}</span>
              <span className={styles.hwItem__value}>{hardwareProfile.cpu_name}</span>
              <span style={{ fontSize: '0.45em', color: 'var(--color-text-muted)' }}>
                {t('settings.coreCount', { count: String(hardwareProfile.cpu_count) })}
              </span>
            </div>
            <div className={styles.hwItem}>
              <span className={styles.hwItem__label}>{t('settings.totalRam')}</span>
              <span className={styles.hwItem__value}>{(hardwareProfile.total_ram_mb / 1024).toFixed(1)} GB</span>
            </div>
            <div className={styles.hwItem}>
              <span className={styles.hwItem__label}>{t('settings.gpu')}</span>
              <span className={styles.hwItem__value}>{hardwareProfile.gpu_name || t('settings.unknown')}</span>
            </div>
            <div className={`${styles.hwItem} ${styles.hwItem__full}`}>
              <span className={styles.hwItem__label}>{t('settings.performanceScore')}</span>
              <div className={styles.scoreWrapper}>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreBar__fill}
                    style={{ width: `${(hardwareProfile.performance_score / 10) * 100}%` }}
                  />
                </div>
                <span className={styles.scoreText}>{hardwareProfile.performance_score}/10</span>
                <span className={`${styles.scoreLevel} ${styles[`scoreLevel--${hardwareProfile.performance_level}`]}`}>
                  {hardwareProfile.performance_level.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: '0.6em', color: 'var(--color-text-muted)' }}>{t('common.loading')}</span>
        )}
      </SectionCard>

      <SectionCard id="sec-gc-tuning" title={t('settings.gcTuning')}>
        {gcRecs.length === 0 ? (
          <span style={{ fontSize: '0.6em', color: 'var(--color-text-muted)' }}>{t('common.loading')}</span>
        ) : (
          <div className={styles.gcGrid}>
            {gcRecs.map((rec) => {
              const badge = getSuitabilityBadge(t, rec.suitable_for);
              return (
                <div key={rec.gc_type} className={styles.gcCard}>
                  <div className={styles.gcCard__header}>
                    <span className={styles.gcCard__title}>{rec.gc_type}</span>
                    <span className={`${styles.gcCard__badge} ${styles[`gcCard__badge--${badge.variant}`]}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className={styles.gcCard__desc}>{rec.description}</div>
                  <div className={styles.gcCard__desc} style={{ fontSize: '0.55em', color: 'var(--color-text-muted)' }}>
                    {rec.reason}
                  </div>
                  <div className={styles.gcCard__argsLabel}>
                    {t('settings.jvmArgsLabel')} · Heap {rec.heap_size_mb}MB · Metaspace {rec.metaspace_mb}MB
                  </div>
                  <div className={styles.gcCard__args}>
                    {rec.jvm_args.map((arg, i) => (
                      <span key={i} className={styles.gcCard__arg}>
                        {arg}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant={gcCopied[rec.gc_type] ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handleCopyGcArgs(rec.gc_type, rec.jvm_args)}
                  >
                    {gcCopied[rec.gc_type] ? t('settings.copied') : t('settings.copyArgs')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard id="sec-disk-usage" title={t('settings.diskUsage')}>
        {diskUsage ? (
          <>
            <div className={styles.diskLegend}>
              {[
                { key: 'instances', label: t('settings.diskUsageInstances'), bytes: diskUsage.instances_bytes },
                { key: 'versions', label: t('settings.diskUsageVersions'), bytes: diskUsage.versions_bytes },
                { key: 'libraries', label: t('settings.diskUsageLibraries'), bytes: diskUsage.libraries_bytes },
                { key: 'assets', label: t('settings.diskUsageAssets'), bytes: diskUsage.assets_bytes },
                { key: 'logs', label: t('settings.diskUsageLogs'), bytes: diskUsage.logs_bytes },
                { key: 'other', label: t('settings.diskUsageOther'), bytes: diskUsage.other_bytes },
              ]
                .filter((item) => item.bytes > 0)
                .map((item) => (
                  <div key={item.key} className={styles.diskLegend__item}>
                    <div className={`${styles.diskLegend__dot} ${styles[`diskLegend__dot--${item.key}`]}`} />
                    <span className={styles.diskLegend__text}>{item.label}</span>
                  </div>
                ))}
            </div>
            <div className={styles.diskTotal}>
              <div className={styles.diskTotal__bar}>
                {diskUsage.instances_bytes > 0 && (
                  <div
                    className={`${styles.diskTotal__segment} ${styles['diskTotal__segment--instances']}`}
                    style={{ width: `${(diskUsage.instances_bytes / diskUsage.total_bytes) * 100}%` }}
                  />
                )}
                {diskUsage.versions_bytes > 0 && (
                  <div
                    className={`${styles.diskTotal__segment} ${styles['diskTotal__segment--versions']}`}
                    style={{ width: `${(diskUsage.versions_bytes / diskUsage.total_bytes) * 100}%` }}
                  />
                )}
                {diskUsage.libraries_bytes > 0 && (
                  <div
                    className={`${styles.diskTotal__segment} ${styles['diskTotal__segment--libraries']}`}
                    style={{ width: `${(diskUsage.libraries_bytes / diskUsage.total_bytes) * 100}%` }}
                  />
                )}
                {diskUsage.assets_bytes > 0 && (
                  <div
                    className={`${styles.diskTotal__segment} ${styles['diskTotal__segment--assets']}`}
                    style={{ width: `${(diskUsage.assets_bytes / diskUsage.total_bytes) * 100}%` }}
                  />
                )}
                {diskUsage.logs_bytes > 0 && (
                  <div
                    className={`${styles.diskTotal__segment} ${styles['diskTotal__segment--logs']}`}
                    style={{ width: `${(diskUsage.logs_bytes / diskUsage.total_bytes) * 100}%` }}
                  />
                )}
                {diskUsage.other_bytes > 0 && (
                  <div
                    className={`${styles.diskTotal__segment} ${styles['diskTotal__segment--other']}`}
                    style={{ width: `${(diskUsage.other_bytes / diskUsage.total_bytes) * 100}%` }}
                  />
                )}
              </div>
              <span className={styles.diskTotal__text}>
                {t('settings.diskUsageTotal')}: {formatBytes(diskUsage.total_bytes)}
              </span>
            </div>
            <div className={styles.breakdown}>
              <div className={styles.breakdown__header}>{t('settings.diskUsageBreakdown')}</div>
              {diskUsage.breakdown.map((item, i) => (
                <div key={i} className={styles.breakdownRow}>
                  <span className={styles.breakdownRow__name}>{item.name}</span>
                  <div className={styles.breakdownRow__barWrapper}>
                    <div
                      className={styles.breakdownRow__bar}
                      style={{ width: `${(item.bytes / diskUsage.total_bytes) * 100}%` }}
                    />
                  </div>
                  <span className={styles.breakdownRow__size}>{formatBytes(item.bytes)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <span style={{ fontSize: '0.6em', color: 'var(--color-text-muted)' }}>{t('common.loading')}</span>
        )}
      </SectionCard>

      <SectionCard id="sec-file-mgmt" title={t('settings.fileMgmt.title')}>
        <div className={styles.fileMgmtSection}>
          <div className={styles.fileMgmtSection__header}>
            <span className={styles.fileMgmtSection__title}>{t('settings.fileMgmt.installedVersions')}</span>
            <span style={{ fontSize: '0.45em', color: 'var(--color-text-muted)' }}>
              {installedVersions.length} {t('settings.fileMgmt.versionCount')}
            </span>
          </div>
          {versionsLoading ? (
            <span style={{ fontSize: '0.6em', color: 'var(--color-text-muted)' }}>{t('common.loading')}</span>
          ) : installedVersions.length === 0 ? (
            <span style={{ fontSize: '0.6em', color: 'var(--color-text-dim)' }}>
              {t('settings.fileMgmt.noVersions')}
            </span>
          ) : (
            <div className={styles.fileMgmtList}>
              {installedVersions.map((v) => (
                <div key={v.version_id} className={styles.fileMgmtRow}>
                  <div className={styles.fileMgmtRow__info}>
                    <span className={styles.fileMgmtRow__name}>{v.version_id}</span>
                    <span
                      className={`${styles.fileMgmtRow__badge} ${v.version_type === 'snapshot' ? styles['fileMgmtRow__badge--snapshot'] : styles['fileMgmtRow__badge--release']}`}
                    >
                      {v.version_type}
                    </span>
                  </div>
                  <div className={styles.fileMgmtRow__actions}>
                    <span className={styles.fileMgmtRow__size}>{formatBytes(v.size_bytes)}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button variant="secondary" size="sm" onClick={() => api.openFolder(v.path)}>
                        {t('common.openFolder')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteVersion(v.version_id)}
                        disabled={deletingVersion === v.version_id}
                      >
                        {deletingVersion === v.version_id ? '...' : t('common.delete')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.fileMgmtSection}>
          <div className={styles.fileMgmtSection__header}>
            <span className={styles.fileMgmtSection__title}>{t('settings.fileMgmt.dataDirectory')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fileManagementGameDir && (
              <div className={styles.fileMgmtRow}>
                <div className={styles.fileMgmtRow__info}>
                  <span
                    className={styles.fileMgmtRow__name}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55em' }}
                  >
                    {fileManagementGameDir}
                  </span>
                </div>
                <div className={styles.fileMgmtRow__actions}>
                  <span className={styles.fileMgmtRow__size} style={{ color: 'var(--color-accent)' }}>
                    {diskUsage ? formatBytes(diskUsage.total_bytes) : '—'}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => api.openFolder(fileManagementGameDir)}>
                    {t('common.openFolder')}
                  </Button>
                </div>
              </div>
            )}

            {diskUsage &&
              [
                { label: t('settings.fileMgmt.instancesDir'), path: 'instances', bytes: diskUsage.instances_bytes },
                { label: t('settings.fileMgmt.versionsDir'), path: 'shared/versions', bytes: diskUsage.versions_bytes },
                {
                  label: t('settings.fileMgmt.librariesDir'),
                  path: 'shared/libraries',
                  bytes: diskUsage.libraries_bytes,
                },
                { label: t('settings.fileMgmt.assetsDir'), path: 'shared/assets', bytes: diskUsage.assets_bytes },
                { label: t('settings.fileMgmt.logsDir'), path: 'logs', bytes: diskUsage.logs_bytes },
              ]
                .filter((d) => d.bytes > 0)
                .map((d) => (
                  <div key={d.path} className={styles.fileMgmtSubRow}>
                    <div className={styles.fileMgmtSubRow__dot} />
                    <span className={styles.fileMgmtSubRow__name}>{d.label}</span>
                    <span className={styles.fileMgmtSubRow__size}>{formatBytes(d.bytes)}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => api.openFolder(`${fileManagementGameDir}/${d.path}`)}
                    >
                      {t('common.openFolder')}
                    </Button>
                  </div>
                ))}
          </div>
        </div>
      </SectionCard>

      <DynamicBgSection t={t} />
      <SoundThemesSection t={t} />
      <MiniModeSection t={t} />
      <FontCustomizationSection t={t} />
      <AccessibilitySection t={t} />
      <WindowEffectsSection t={t} />
      <DiscordSection t={t} />

      <SectionCard id="sec-screenshots" title={t('settings.screenshots')}>
        <SettingRow label={t('settings.screenshotsSelectInstance')}>
          <div style={{ minWidth: 200 }}>
            <Select
              value={screenshotInstanceId}
              onChange={(e) => {
                const id = e.target.value;
                setScreenshotInstanceId(id);
                if (id) {
                  setScreenshotsLoading(true);
                  api
                    .listScreenshots(id)
                    .then((list) => {
                      setScreenshots(list);
                    })
                    .catch(() => {
                      setScreenshots([]);
                    })
                    .finally(() => setScreenshotsLoading(false));
                } else {
                  setScreenshots([]);
                }
              }}
              options={[
                { value: '', label: `-- ${t('settings.screenshotsSelectInstance')} --` },
                ...instances.map((inst) => ({ value: inst.id, label: inst.name })),
              ]}
            />
          </div>
        </SettingRow>
        {screenshotInstanceId &&
          (screenshotsLoading ? (
            <div style={{ fontSize: '0.6em', color: 'var(--color-text-dim)', padding: '8px 0' }}>
              {t('common.loading')}
            </div>
          ) : screenshots.length === 0 ? (
            <div style={{ fontSize: '0.6em', color: 'var(--color-text-dim)', padding: '8px 0' }}>
              {t('screenshots.empty')}
            </div>
          ) : (
            <div className={styles.screenshotGrid}>
              {screenshots.map((ss, i) => (
                <div key={i} className={styles.screenshotRow}>
                  <span className={styles.screenshotRow__name}>{ss.filename}</span>
                  <span className={styles.screenshotRow__size}>
                    {ss.size_bytes >= 1_048_576
                      ? `${(ss.size_bytes / 1_048_576).toFixed(1)} MB`
                      : `${(ss.size_bytes / 1024).toFixed(1)} KB`}
                  </span>
                  <span className={styles.screenshotRow__date}>{new Date(ss.modified).toLocaleDateString()}</span>
                  <Button variant="secondary" size="sm" onClick={() => api.openFolder(ss.path)}>
                    {t('common.openFolder')}
                  </Button>
                </div>
              ))}
            </div>
          ))}
      </SectionCard>

      <SectionCard id="sec-security-overview" title="安全概览">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5em', marginBottom: '0.8em' }}>
          <SecurityScore score={securityScore} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4em', fontSize: '0.55em' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={encryptionStatus.encrypted ? 'ready' : 'error'} />
                <span>凭据加密</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.strict_verification ? 'ready' : 'inactive'} />
                <span>严格验证</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.jvm_args_mode === 'whitelist' ? 'ready' : 'inactive'} />
                <span>JVM 白名单</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.audit_log_enabled ? 'ready' : 'inactive'} />
                <span>审计日志</span>
              </div>
            </div>
          </div>
        </div>
        <SettingRow label="一键修复">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await api.fixFilePermissions();
              const score = await api.getSecurityScore();
              setSecurityScore(score);
            }}
          >
            修复安全问题
          </Button>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-credential-protection" title="凭据保护">
        <SettingRow label="凭据加密存储">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.credential_encryption ?? true}
              onChange={() =>
                handleConfigChange({
                  security: {
                    ...localConfig.security!,
                    credential_encryption: !(localConfig.security?.credential_encryption ?? true),
                  },
                })
              }
            />
            <span
              className={
                localConfig.security?.credential_encryption !== false
                  ? styles.checkboxLabel__text
                  : styles['checkboxLabel__text--muted']
              }
            >
              使用 AES-256-GCM 加密存储账户凭据
            </span>
          </label>
        </SettingRow>
        <SettingRow label="加密状态">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.55em' }}>
            <StatusDot status={encryptionStatus.encrypted ? 'ready' : 'inactive'} />
            <span>
              {encryptionStatus.encrypted ? '已加密' : encryptionStatus.plain ? '明文存储（不安全）' : '无凭据'}
            </span>
          </div>
        </SettingRow>
        {encryptionStatus.plain && !encryptionStatus.encrypted && (
          <SettingRow label="迁移">
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await api.migrateCredentials();
                const status = await api.getEncryptionStatus();
                setEncryptionStatus(status);
                const score = await api.getSecurityScore();
                setSecurityScore(score);
              }}
            >
              迁移到加密存储
            </Button>
          </SettingRow>
        )}
      </SectionCard>

      <SectionCard id="sec-network-security" title="网络安全">
        <SettingRow label="严格下载验证">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.strict_verification ?? true}
              onChange={() =>
                handleConfigChange({
                  security: {
                    ...localConfig.security!,
                    strict_verification: !(localConfig.security?.strict_verification ?? true),
                  },
                })
              }
            />
            <span
              className={
                localConfig.security?.strict_verification !== false
                  ? styles.checkboxLabel__text
                  : styles['checkboxLabel__text--muted']
              }
            >
              拒绝无 SHA1 哈希的下载
            </span>
          </label>
        </SettingRow>
        <SettingRow label="强制 HTTPS">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.enforce_https ?? true}
              onChange={() =>
                handleConfigChange({
                  security: { ...localConfig.security!, enforce_https: !(localConfig.security?.enforce_https ?? true) },
                })
              }
            />
            <span
              className={
                localConfig.security?.enforce_https !== false
                  ? styles.checkboxLabel__text
                  : styles['checkboxLabel__text--muted']
              }
            >
              仅允许 HTTPS 下载源
            </span>
          </label>
        </SettingRow>
        <SettingRow label="启用代理">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.proxy_enabled ?? false}
              onChange={() =>
                handleConfigChange({
                  security: {
                    ...localConfig.security!,
                    proxy_enabled: !(localConfig.security?.proxy_enabled ?? false),
                  },
                })
              }
            />
          </label>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-launch-security" title="启动安全">
        <SettingRow label="JVM 参数模式">
          <Select
            value={localConfig.security?.jvm_args_mode || 'whitelist'}
            onChange={(e) =>
              handleConfigChange({
                security: { ...localConfig.security!, jvm_args_mode: e.target.value },
              })
            }
            options={[
              { value: 'whitelist', label: '白名单（推荐）' },
              { value: 'custom', label: '自定义（不安全）' },
            ]}
          />
        </SettingRow>
        <SettingRow label="沙箱模式">
          <Select
            value={localConfig.security?.sandbox_mode || 'off'}
            onChange={(e) =>
              handleConfigChange({
                security: { ...localConfig.security!, sandbox_mode: e.target.value },
              })
            }
            options={[
              { value: 'off', label: '关闭' },
              { value: 'basic', label: '基础' },
              { value: 'strict', label: '严格' },
            ]}
          />
        </SettingRow>
        {sandboxInfo && !sandboxInfo.available && localConfig.security?.sandbox_mode !== 'off' && (
          <div style={{ fontSize: '0.5em', color: '#ffaa00', padding: '0.3em 0' }}>
            ⚠ 当前平台沙箱不可用（需要 {sandboxInfo.tool || 'firejail/sandbox-exec'}）
          </div>
        )}
        <SettingRow label="安全启动检查">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.secure_launch_check ?? true}
              onChange={() =>
                handleConfigChange({
                  security: {
                    ...localConfig.security!,
                    secure_launch_check: !(localConfig.security?.secure_launch_check ?? true),
                  },
                })
              }
            />
            <span
              className={
                localConfig.security?.secure_launch_check !== false
                  ? styles.checkboxLabel__text
                  : styles['checkboxLabel__text--muted']
              }
            >
              启动前检查 Java 完整性和 JVM 参数
            </span>
          </label>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-api-key-management" title="API 密钥管理">
        <SettingRow label="CurseForge API Key">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showCfKey ? 'text' : 'password'}
                value={cfKeyValue}
                onChange={(e) => setCfKeyValue(e.target.value)}
                placeholder={cfKeyStatus?.configured ? '已配置（输入新值以更新）' : '输入 CurseForge API Key'}
                className={styles.textInput}
                style={{ width: '100%', paddingRight: '3em' }}
              />
              <button
                onClick={() => setShowCfKey(!showCfKey)}
                style={{
                  position: 'absolute',
                  right: '0.5em',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '0.5em',
                }}
              >
                {showCfKey ? '隐藏' : '显示'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.3em' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  if (cfKeyValue.trim()) {
                    await api.saveApiKey('cf_api_key', cfKeyValue.trim());
                    setCfKeyValue('');
                    const status = await api.getApiKeyStatus('cf_api_key');
                    setCfKeyStatus(status);
                  }
                }}
              >
                保存
              </Button>
              {cfKeyStatus?.configured && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await api.deleteApiKey('cf_api_key');
                    const status = await api.getApiKeyStatus('cf_api_key');
                    setCfKeyStatus(status);
                  }}
                >
                  删除
                </Button>
              )}
            </div>
          </div>
        </SettingRow>
        <SettingRow label="密钥状态">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.55em' }}>
            <StatusDot status={cfKeyStatus?.configured ? 'ready' : 'inactive'} />
            <span>{cfKeyStatus?.configured ? `已配置（来源: ${cfKeyStatus.source}）` : '未配置'}</span>
          </div>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-security-audit" title="安全审计">
        <SettingRow label="审计日志">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.audit_log_enabled ?? true}
              onChange={() =>
                handleConfigChange({
                  security: {
                    ...localConfig.security!,
                    audit_log_enabled: !(localConfig.security?.audit_log_enabled ?? true),
                  },
                })
              }
            />
            <span
              className={
                localConfig.security?.audit_log_enabled !== false
                  ? styles.checkboxLabel__text
                  : styles['checkboxLabel__text--muted']
              }
            >
              记录安全相关操作日志
            </span>
          </label>
        </SettingRow>
        <SettingRow label="查看审计日志">
          <Button variant="secondary" size="sm" onClick={() => setAuditLogOpen(true)}>
            打开日志查看器
          </Button>
        </SettingRow>
        {loginHistory.length > 0 && (
          <div style={{ marginTop: '0.5em' }}>
            <div
              style={{
                fontSize: '0.5em',
                color: '#888',
                marginBottom: '0.3em',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              最近登录
            </div>
            {loginHistory.slice(0, 5).map((entry, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.5em', padding: '0.15em 0' }}
              >
                <StatusDot status={entry.success ? 'ready' : 'error'} />
                <span style={{ color: '#888' }}>{entry.timestamp.replace('T', ' ').slice(0, 19)}</span>
                <span>{entry.username}</span>
                <Badge variant={entry.auth_type === 'microsoft' ? 'default' : 'muted'}>{entry.auth_type}</Badge>
              </div>
            ))}
          </div>
        )}
        <AuditLogViewer open={auditLogOpen} onClose={() => setAuditLogOpen(false)} />
      </SectionCard>

      <BatterySection t={t} />
      <DownloadSection t={t} addToast={addToast} />

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.footer}>
        <span className={styles.footer__brand}>{t('settings.nowintPresent')}</span>
        <a
          href="https://qun.qq.com/universal-share/share?ac=1&authKey=nRLO82GV%2FbYhC6GleAK72oZY%2Fhs4Vz2qh2OcS%2BawOildd0nySW9wLWCJg%2BLpS0%2BG&busi_data=eyJncm91cENvZGUiOiIxMDE2NjQxNjkxIiwidG9rZW4iOiJMQjR0cWZLcGFNcW9nSVJCOVQ3LzZ1Y1o4V0wrd1ljZTJVaWhSdUFUbDRKWGZaNExqSTZSMUdTMk04UUdCc2IvIiwidWluIjoiNjc0MDAwMjQ5In0%3D&data=u5JO0vDgzgicnHsVlwKbrFSyvCXZpH1vmPTkcluZ8ApBfyg1DFU1uQ-SCpXFFvvFWqsr8fHFId9keRmqUjXl1A&svctype=4&tempid=h5_group_info"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footer__qqBtn}
        >
          {t('settings.joinQQGroup') || '加入QQ群'}
        </a>
      </div>
    </div>
  );
}
