import { useState, useEffect, useMemo } from 'react';
import { api, type AppConfig, type HardwareProfile, type DiskUsage } from '../api';
import { useAuth } from '../stores/authStore';
import { useConfig } from '../stores/configStore';
import { useInstances } from '../stores/instanceStore';
import { useTheme, type Theme, UI_SCALE_MIN, UI_SCALE_MAX } from '../stores/themeStore';
import { useI18n } from '../i18n';
import { StatusDot, Badge, Button, TextInput, Select, Checkbox, Slider, SettingsNav } from '../components/ui';
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

function getSuitabilityBadge(suitableFor: string): { label: string; variant: 'success' | 'warning' | 'danger' } {
  switch (suitableFor) {
    case 'recommended': return { label: '推荐', variant: 'success' };
    case 'optional': return { label: '可选', variant: 'warning' };
    default: return { label: '不推荐', variant: 'danger' };
  }
}

export default function SettingsPage() {
  const { state: authState, logout, switchAccount } = useAuth();
  const { state: cfgState, saveConfig } = useConfig();
  const { state: { instances } } = useInstances();
  const { theme, switchThemeWithAnimation, uiScale, setUiScale } = useTheme();
  const { t, lang, setLang } = useI18n();
  const auth = authState.currentUser;
  const config = cfgState.config;
  const [localConfig, setLocalConfig] = useState<AppConfig | null>(config);
  const [javaVersion, setJavaVersion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);

  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(() => {
    try { return localStorage.getItem('bonnext_discord_rpc') === 'true'; } catch { return false; }
  });
  const [batteryStatus, setBatteryStatus] = useState<{ on_battery: boolean; percentage: number; charging: boolean } | null>(null);
  const [powerSavingMode, setPowerSavingMode] = useState(() => {
    try { return localStorage.getItem('bonnext_power_saving') === 'true'; } catch { return false; }
  });
  const [downloadConfig, setDownloadConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('bonnext_download_config');
      return saved ? JSON.parse(saved) : { maxSpeed: 0, pauseDuringGame: true, priority: 'normal' };
    } catch { return { maxSpeed: 0, pauseDuringGame: true, priority: 'normal' }; }
  });
  const [gcRecs, setGcRecs] = useState<Array<{ gc_type: string; jvm_args: string[]; description: string; suitable_for: string }>>([]);
  const [gcCopied, setGcCopied] = useState<Record<string, boolean>>({});

  const [bgTheme, setBgTheme] = useState<string>(() => {
    try { return localStorage.getItem('bonnext_bg_theme') || 'minimal'; } catch { return 'minimal'; }
  });
  const [soundTheme, setSoundTheme] = useState<string>(() => {
    try { return localStorage.getItem('bonnext_sound_theme') || 'cyberpunk'; } catch { return 'cyberpunk'; }
  });
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    try { return Number(localStorage.getItem('bonnext_sound_volume')) || 50; } catch { return 50; }
  });
  const [miniMode, setMiniMode] = useState<boolean>(() => {
    try { return localStorage.getItem('bonnext_mini_mode') === 'true'; } catch { return false; }
  });
  const [fontWeight, setFontWeight] = useState<number>(() => {
    try { return Number(localStorage.getItem('bonnext_font_weight')) || 400; } catch { return 400; }
  });
  const [fontLineHeight, setFontLineHeight] = useState<number>(() => {
    try { return Number(localStorage.getItem('bonnext_font_line_height')) || 1.5; } catch { return 1.5; }
  });
  const [colorblindMode, setColorblindMode] = useState<string>(() => {
    try { return localStorage.getItem('bonnext_colorblind_mode') || 'none'; } catch { return 'none'; }
  });
  const [transparency, setTransparency] = useState<number>(() => {
    try { return Number(localStorage.getItem('bonnext_transparency')) || 1.0; } catch { return 1.0; }
  });
  const [blurStrength, setBlurStrength] = useState<number>(() => {
    try { return Number(localStorage.getItem('bonnext_blur')) || 0; } catch { return 0; }
  });
  const [screenshotInstanceId, setScreenshotInstanceId] = useState<string>('');
  const [screenshots, setScreenshots] = useState<Array<{ filename: string; path: string; size_bytes: number; modified: string }>>([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);

  useEffect(() => {
    if (config) setLocalConfig(config);
    api.findJava().then((p) => api.checkJavaVersion(p)).then(setJavaVersion).catch(() => {});
  }, [config]);

  useEffect(() => {
    api.getHardwareProfile().then(setHardwareProfile).catch(() => {});
    api.getDiskUsage().then(setDiskUsage).catch(() => {});
  }, []);

  useEffect(() => {
    const ramMb = hardwareProfile?.total_ram_mb || 8192;
    api.getGcRecommendations(ramMb).then(setGcRecs).catch(() => {});
  }, [hardwareProfile]);

  useEffect(() => { try { localStorage.setItem('bonnext_bg_theme', bgTheme); } catch {} }, [bgTheme]);
  useEffect(() => { try { localStorage.setItem('bonnext_sound_theme', soundTheme); } catch {} }, [soundTheme]);
  useEffect(() => { try { localStorage.setItem('bonnext_sound_volume', String(soundVolume)); } catch {} }, [soundVolume]);
  useEffect(() => { try { localStorage.setItem('bonnext_mini_mode', String(miniMode)); } catch {} }, [miniMode]);
  useEffect(() => {
    if (miniMode) {
      document.documentElement.classList.add('mini-mode');
    } else {
      document.documentElement.classList.remove('mini-mode');
    }
  }, [miniMode]);
  useEffect(() => { try { localStorage.setItem('bonnext_font_weight', String(fontWeight)); } catch {} }, [fontWeight]);
  useEffect(() => { try { localStorage.setItem('bonnext_font_line_height', String(fontLineHeight)); } catch {} }, [fontLineHeight]);
  useEffect(() => { try { localStorage.setItem('bonnext_colorblind_mode', colorblindMode); } catch {} }, [colorblindMode]);
  useEffect(() => { try { localStorage.setItem('bonnext_transparency', String(transparency)); } catch {} }, [transparency]);
  useEffect(() => { try { localStorage.setItem('bonnext_blur', String(blurStrength)); } catch {} }, [blurStrength]);

  useEffect(() => {
    document.documentElement.style.setProperty('--bonnext-font-weight', String(fontWeight));
    document.documentElement.style.setProperty('--bonnext-line-height', String(fontLineHeight));
    document.documentElement.style.setProperty('--bonnext-transparency', String(transparency));
    document.documentElement.style.setProperty('--bonnext-blur', `${blurStrength}px`);
  }, [fontWeight, fontLineHeight, transparency, blurStrength]);

  useEffect(() => {
    document.documentElement.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia');
    if (colorblindMode !== 'none') {
      document.documentElement.classList.add(`cb-${colorblindMode}`);
    }
  }, [colorblindMode]);

  useEffect(() => {
    document.documentElement.classList.remove('bg-cyberpunk', 'bg-starfield', 'bg-matrix', 'bg-minimal');
    document.documentElement.classList.add(`bg-${bgTheme}`);
  }, [bgTheme]);

  useEffect(() => {
    api.getBatteryStatus().then(setBatteryStatus).catch(() => {});
  }, []);

  useEffect(() => {
    try { localStorage.setItem('bonnext_discord_rpc', String(discordRpcEnabled)); } catch {}
  }, [discordRpcEnabled]);

  useEffect(() => {
    try { localStorage.setItem('bonnext_power_saving', String(powerSavingMode)); } catch {}
  }, [powerSavingMode]);

  useEffect(() => {
    try { localStorage.setItem('bonnext_download_config', JSON.stringify(downloadConfig)); } catch {}
  }, [downloadConfig]);

  const handleDiscordRpcToggle = async () => {
    const next = !discordRpcEnabled;
    setDiscordRpcEnabled(next);
    try {
      if (next) {
        await api.startDiscordRpc();
      } else {
        await api.stopDiscordRpc();
      }
    } catch {}
  };

  const handleSaveDownloadConfig = async () => {
    try {
      await api.setDownloadScheduleConfig({
        max_speed_bytes: downloadConfig.maxSpeed * 1_048_576,
        active_during_game: !downloadConfig.pauseDuringGame,
        priority: downloadConfig.priority,
      });
    } catch {}
  };

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
        filters: [{ name: 'Java', extensions: ['exe', 'bin', ''] }],
      });
      if (selected && typeof selected === 'string') {
        setLocalConfig((prev) => prev ? { ...prev, java_path: selected } : prev);
      }
    } catch { /* dialog cancelled */ }
  };

  const handleCopyGcArgs = async (gcType: string, args: string[]) => {
    try {
      await navigator.clipboard.writeText(args.join(' '));
      setGcCopied((prev) => ({ ...prev, [gcType]: true }));
      setTimeout(() => setGcCopied((prev) => ({ ...prev, [gcType]: false })), 2000);
    } catch { /* clipboard fail */ }
  };

  const handleBrowseGameDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setLocalConfig((prev) => prev ? { ...prev, game_dir: selected } : prev);
      }
    } catch { /* dialog cancelled */ }
  };

  if (!localConfig || !auth) return (
    <div style={{ color: '#555', fontSize: '0.7em', padding: 40, textAlign: 'center' }}>{t('common.loading')}</div>
  );

  const memoryGB = Math.round(localConfig.max_memory / 1024);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  };

  const navCategories: NavCategory[] = useMemo(() => [
    {
      id: 'general',
      label: t('settings.nav.general'),
      sectionIds: ['sec-account', 'sec-language', 'sec-theme', 'sec-font-custom'],
    },
    {
      id: 'performance',
      label: t('settings.nav.performance'),
      sectionIds: ['sec-java', 'sec-memory', 'sec-gc-tuning', 'sec-disk-usage'],
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
  ], [t]);

  return (
    <div className={`page-enter ${styles.page}`}>
      <SettingsNav categories={navCategories} />

      {/* Account section */}
      <SectionCard id="sec-account" title={t('settings.account')}>
        <div className={styles.accountRow}>
          <StatusDot status="ready" />
          <span className={styles.accountName}>{auth.username}</span>
          <Badge variant="default">
            {auth.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
          </Badge>
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="secondary" size="sm" onClick={() => { logout(); window.location.reload(); }}>
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

      {/* Java runtime */}
      <SectionCard id="sec-java" title={t('settings.java')}>
        <SettingRow label={t('settings.javaVersion')}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <div style={{ minWidth: 200 }}>
              <Select
                value={localConfig.java_path || ''}
                onChange={(e) => setLocalConfig({ ...localConfig, java_path: e.target.value || null })}
                options={[
                  { value: '', label: javaVersion ? `Java ${javaVersion} (${t('instanceDetail.autoDetect')})` : t('instanceDetail.autoDetect') },
                  ...(localConfig.java_path ? [{ value: localConfig.java_path, label: localConfig.java_path }] : []),
                ]}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleBrowseJava}>{t('settings.browse')}</Button>
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

      {/* Memory & Performance */}
      <SectionCard id="sec-memory" title={t('settings.memory')}>
        <SettingRow label={t('settings.allocatedMemory')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF' }}>
              {memoryGB} {t('common.unit.gb')}
            </span>
            <div style={{ flex: 1 }}>
              <Slider gradient
                value={memoryGB}
                min={1}
                max={16}
                onChange={(val) => setLocalConfig({ ...localConfig, max_memory: val * 1024 })}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: '#555' }}>
              {memoryGB} {t('common.unit.gb')}
            </span>
          </div>
        </SettingRow>

        <SettingRow label={t('settings.resolution')}>
          <div style={{ minWidth: 180 }}>
            <Select
              value={`${localConfig.window_width}x${localConfig.window_height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setLocalConfig({ ...localConfig, window_width: w, window_height: h });
              }}
              options={RESOLUTION_OPTIONS}
            />
          </div>
        </SettingRow>
      </SectionCard>

      {/* Launch behavior */}
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
            <span className={!localConfig.keep_launcher_open ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
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
            <span className={localConfig.auto_update_java ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              {t('settings.autoUpdateJava')}
            </span>
          </label>
        </div>
      </SectionCard>

      {/* Data directory */}
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
            <Button variant="secondary" size="sm" onClick={handleBrowseGameDir}>{t('settings.browse')}</Button>
          </div>
        </SettingRow>
      </SectionCard>

      {/* Theme */}
      <SectionCard id="sec-theme" title={t('settings.theme')}>
        <SettingRow label={t('settings.theme')}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              ['dark', t('settings.themeDark')],
              ['light', t('settings.themeLight')],
              ['oled', t('settings.themeOled')],
            ] as [Theme, string][]).map(([val, label]) => (
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
              <Slider gradient
                value={uiScale}
                min={UI_SCALE_MIN}
                max={UI_SCALE_MAX}
                step={0.05}
                onChange={setUiScale}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: '#555' }}>
              {Math.round(UI_SCALE_MIN * 100)}%–{Math.round(UI_SCALE_MAX * 100)}%
            </span>
          </div>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-language" title="Language / 语言">
        <SettingRow label={t('settings.language')}>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              variant={lang === 'zh-CN' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setLang('zh-CN')}
            >
              中文
            </Button>
            <Button
              variant={lang === 'en-US' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setLang('en-US')}
            >
              English
            </Button>
          </div>
        </SettingRow>
      </SectionCard>

      {/* Hardware Profile */}
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
              <span className={styles.hwItem__value}>
                {(hardwareProfile.total_ram_mb / 1024).toFixed(1)} GB
              </span>
            </div>
            <div className={styles.hwItem}>
              <span className={styles.hwItem__label}>{t('settings.gpu')}</span>
              <span className={styles.hwItem__value}>{hardwareProfile.gpu_name || 'Unknown'}</span>
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

      {/* GC Tuning */}
      <SectionCard id="sec-gc-tuning" title="GC TUNING">
        {gcRecs.length === 0 ? (
          <span style={{ fontSize: '0.6em', color: 'var(--color-text-muted)' }}>{t('common.loading')}</span>
        ) : (
          <div className={styles.gcGrid}>
            {gcRecs.map((rec) => {
              const badge = getSuitabilityBadge(rec.suitable_for);
              return (
                <div key={rec.gc_type} className={styles.gcCard}>
                  <div className={styles.gcCard__header}>
                    <span className={styles.gcCard__title}>{rec.gc_type}</span>
                    <span className={`${styles.gcCard__badge} ${styles[`gcCard__badge--${badge.variant}`]}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className={styles.gcCard__desc}>{rec.description}</div>
                  <div className={styles.gcCard__argsLabel}>JVM ARGS</div>
                  <div className={styles.gcCard__args}>
                    {rec.jvm_args.map((arg, i) => (
                      <span key={i} className={styles.gcCard__arg}>{arg}</span>
                    ))}
                  </div>
                  <Button
                    variant={gcCopied[rec.gc_type] ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handleCopyGcArgs(rec.gc_type, rec.jvm_args)}
                  >
                    {gcCopied[rec.gc_type] ? '✓ Copied' : 'Copy Args'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Disk Usage */}
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
              ].filter((item) => item.bytes > 0).map((item) => (
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

      {/* Dynamic Background */}
      <SectionCard id="sec-dynamic-bg" title={t('settings.dynamicBg')}>
        <div className={styles.bgPresetRow}>
          {[
            { key: 'cyberpunk', icon: '\u2B21', label: t('settings.dynamicBgCyberpunk'), hint: t('settings.dynamicBgHintCyberpunk') },
            { key: 'starfield', icon: '\u2726', label: t('settings.dynamicBgStarfield'), hint: t('settings.dynamicBgHintStarfield') },
            { key: 'matrix', icon: '\u229E', label: t('settings.dynamicBgMatrix'), hint: t('settings.dynamicBgHintMatrix') },
            { key: 'minimal', icon: '\u25CB', label: t('settings.dynamicBgMinimal'), hint: t('settings.dynamicBgHintMinimal') },
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
          {[
            { key: 'cyberpunk', hint: t('settings.dynamicBgHintCyberpunk') },
            { key: 'starfield', hint: t('settings.dynamicBgHintStarfield') },
            { key: 'matrix', hint: t('settings.dynamicBgHintMatrix') },
            { key: 'minimal', hint: t('settings.dynamicBgHintMinimal') },
          ].find((p) => p.key === bgTheme)?.hint}
        </div>
      </SectionCard>

      {/* Sound Themes */}
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
              <Slider gradient
                value={soundVolume}
                min={0}
                max={100}
                onChange={setSoundVolume}
              />
            </div>
          </div>
        </SettingRow>
        <SettingRow label={t('settings.soundTest')}>
          <Button variant="secondary" size="sm" onClick={() => console.log('Test sound:', { theme: soundTheme, volume: soundVolume })}>
            {t('settings.soundTest')}
          </Button>
        </SettingRow>
      </SectionCard>

      {/* Mini Mode */}
      <SectionCard id="sec-mini-mode" title={t('settings.miniMode')}>
        <label className={styles.checkboxLabel}>
          <Checkbox
            on={miniMode}
            onChange={setMiniMode}
          />
          <span className={styles.checkboxLabel__text}>{t('settings.miniModeToggle')}</span>
        </label>
        <div className={styles.mutedDesc}>{t('settings.miniModeDesc')}</div>
      </SectionCard>

      {/* Font Customization */}
      <SectionCard id="sec-font-custom" title={t('settings.fontCustomization')}>
        <SettingRow label={t('settings.fontWeight')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
              {fontWeight}
            </span>
            <div style={{ flex: 1 }}>
              <Slider gradient
                value={fontWeight}
                min={300}
                max={700}
                step={100}
                onChange={setFontWeight}
              />
            </div>
          </div>
        </SettingRow>
        <SettingRow label={t('settings.fontLineHeight')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
              {fontLineHeight.toFixed(1)}
            </span>
            <div style={{ flex: 1 }}>
              <Slider gradient
                value={fontLineHeight}
                min={1.2}
                max={2.0}
                step={0.1}
                onChange={setFontLineHeight}
              />
            </div>
          </div>
        </SettingRow>
        <div className={styles.fontPreview} style={{ fontWeight: fontWeight, lineHeight: fontLineHeight }}>
          <div style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
            {t('settings.fontPreview')}
          </div>
          <div style={{ fontSize: '0.7em' }}>
            {t('settings.fontPreviewText')}
          </div>
        </div>
      </SectionCard>

      {/* Accessibility */}
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

      {/* Window Effects */}
      <SectionCard id="sec-window-effects" title={t('settings.windowEffects')}>
        <SettingRow label={t('settings.transparency')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
              {transparency.toFixed(1)}
            </span>
            <div style={{ flex: 1 }}>
              <Slider gradient
                value={transparency}
                min={0.7}
                max={1.0}
                step={0.05}
                onChange={setTransparency}
              />
            </div>
          </div>
        </SettingRow>
        <SettingRow label={t('settings.blurStrength')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF', minWidth: 36 }}>
              {blurStrength}px
            </span>
            <div style={{ flex: 1 }}>
              <Slider gradient
                value={blurStrength}
                min={0}
                max={20}
                step={1}
                onChange={setBlurStrength}
              />
            </div>
          </div>
        </SettingRow>
      </SectionCard>

      {/* Discord RPC */}
      <SectionCard id="sec-discord" title={t('settings.discord')}>
        <SettingRow label={t('settings.discordRpc')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <label className={styles.checkboxLabel}>
              <Checkbox
                on={discordRpcEnabled}
                onChange={handleDiscordRpcToggle}
              />
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

      {/* Screenshots */}
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
                  api.listScreenshots(id).then((list) => {
                    setScreenshots(list);
                  }).catch(() => {
                    setScreenshots([]);
                  }).finally(() => setScreenshotsLoading(false));
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
        {screenshotInstanceId && (
          screenshotsLoading ? (
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
                  <span className={styles.screenshotRow__date}>
                    {new Date(ss.modified).toLocaleDateString()}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => api.openFolder(ss.path)}
                  >
                    {t('common.openFolder')}
                  </Button>
                </div>
              ))}
            </div>
          )
        )}
      </SectionCard>

      {/* Battery Management */}
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
                      : 'AC Power'}
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
              <Checkbox
                on={powerSavingMode}
                onChange={() => setPowerSavingMode(!powerSavingMode)}
              />
              <span className={powerSavingMode ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
                {t('settings.batteryPowerSavingDesc')}
              </span>
            </label>
          </div>
        </SettingRow>
      </SectionCard>

      {/* Download Scheduler */}
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
            <span className={downloadConfig.pauseDuringGame ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
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

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setLocalConfig(config)}>{t('settings.reset')}</Button>
        <Button variant="primary" size="md" disabled={saving} onClick={handleSave}>
          {saving ? t('settings.saving') : saved ? '✓ ' + t('settings.saved') : t('settings.save')}
        </Button>
      </div>

      <div className={styles.footer}>
        <span className={styles.footer__brand}>Nowint Present</span>
        <a
          href="https://qun.qq.com/universal-share/share?ac=1&authKey=nRLO82GV%2FbYhC6GleAK72oZY%2Fhs4Vz2qh2OcS%2BawOildd0nySW9wLWCJg%2BLpS0%2BG&busi_data=eyJncm91cENvZGUiOiIxMDE2NjQxNjkxIiwidG9rZW4iOiJMQjR0cWZLcGFNcW9nSVJCOVQ3LzZ1Y1o4V0wrd1ljZTJVaWhSdUFUbDRKWGZaNExqSTZSMUdTMk04UUdCc2IvIiwidWluIjoiNjc0MDAwMjQ5In0%3D&data=u5JO0vDgzgicnHsVlwKbrFSyvCXZpH1vmPTkcluZ8ApBfyg1DFU1uQ-SCpXFFvvFWqsr8fHFId9keRmqUjXl1A&svctype=4&tempid=h5_group_info"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footer__qqBtn}
        >
          加入QQ群
        </a>
      </div>
    </div>
  );
}
