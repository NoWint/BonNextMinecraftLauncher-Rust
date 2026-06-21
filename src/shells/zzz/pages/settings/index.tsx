import { useState, useEffect, useMemo, Suspense, lazy, type LazyExoticComponent, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatError } from '../../../../shared/utils/errorMapping';
import { formatDate } from '../../../../shared/utils/format';
import { useFormField } from '../../../../shared/hooks/useFormField';
import { javaPath, proxyUrl } from '../../../../shared/utils/validators';
import formStyles from '../../components/ui/FormField.module.css';
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
  type RecommendedConfig,
  type StoredAccount,
} from '../../../../shared/api';
import { useAuth } from '../../../../shared/stores/authStore';
import { useConfig } from '../../../../shared/stores/configStore';
import { useInstances } from '../../../../shared/stores/instanceStore';
import { useI18n } from '../../../../shared/i18n';
import { useToast } from '../../../../shared/stores/toastStore';
import {
  StatusDot,
  Badge,
  Button,
  Modal,
  TextInput,
  Select,
  Checkbox,
  SettingsNav,
  resetOnboarding,
  SecurityScore,
  AuditLogViewer,
  ContextHelp,
} from '../../components/ui';
import JVMPresets, { type JVMPreset } from '../../components/ui/JVMPresets';
import { Icon } from '../../components/ui/Icon';
import type { NavCategory } from '../../components/ui';
import { open } from '@tauri-apps/plugin-dialog';
import styles from '../SettingsPage.module.css';

import MemorySection from './MemorySection';
import { SectionCard, SettingRow } from './MemorySection';
import ThemeSection from './ThemeSection';
import FontCustomizationSection from './FontCustomizationSection';
import WindowEffectsSection from './WindowEffectsSection';
import SoundThemesSection from './SoundThemesSection';
import DynamicBgSection from './DynamicBgSection';
import DownloadSection from './DownloadSection';
import NetworkSection from './NetworkSection';
import AccessibilitySection from './AccessibilitySection';
import MiniModeSection from './MiniModeSection';
import DiscordSection from './DiscordSection';
import BatterySection from './BatterySection';
import SkinStationSection from './SkinStationSection';
import AISection from './AISection';
import AchievementDisplay from '../../components/ui/AchievementDisplay';
import JreManagementSection from './JreManagementSection';
import { ShellManagementSection } from './ShellManagementSection';
import { PluginManagementSection } from './PluginManagementSection';
import { TrustedKeysSection } from './TrustedKeysSection';
import { AboutSection } from './AboutSection';
import { PluginErrorBoundary } from '../../../../app/components/PluginErrorBoundary';
import { usePluginSettingsSections } from '../../../../app/hooks/usePluginSettingsSections';

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

export default function SettingsPage() {
  const navigate = useNavigate();
  const { state: authState, logout, switchAccount } = useAuth();
  const { state: cfgState, saveConfig } = useConfig();
  const {
    state: { instances },
  } = useInstances();
  const { t, lang, setLang } = useI18n();
  const { addToast } = useToast();
  const pluginSettingsSections = usePluginSettingsSections();
  const pluginSettingsComponents = useMemo(() => {
    const map: Record<string, LazyExoticComponent<ComponentType<unknown>>> = {};
    for (const section of pluginSettingsSections) {
      map[section.id] = lazy(section.component);
    }
    return map;
  }, [pluginSettingsSections]);
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
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<string | null>(null);
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
  const [recommendedConfig, setRecommendedConfig] = useState<RecommendedConfig | null>(null);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const javaPathRules = useMemo(() => [javaPath], []);
  const javaPathField = useFormField(localConfig?.java_path || '', javaPathRules);
  const proxyUrlRules = useMemo(() => [proxyUrl], []);
  const proxyUrlField = useFormField(localConfig?.security?.proxy_url || '', proxyUrlRules);

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
    api
      .getRecommendedConfig()
      .then(setRecommendedConfig)
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
    setConfirmDeleteVersion(versionId);
  };

  const executeDeleteVersion = async (versionId: string) => {
    setConfirmDeleteVersion(null);
    setDeletingVersion(versionId);
    try {
      await api.deleteVersion(versionId);
      setInstalledVersions((prev) => prev.filter((v) => v.version_id !== versionId));
      addToast({ type: 'success', title: t('settings.fileMgmt.deleteSuccess', { version: versionId }) });
      api
        .getDiskUsage()
        .then(setDiskUsage)
        .catch(() => {});
    } catch (e: unknown) {
      const msg = formatError(e) || t('settings.fileMgmt.deleteFailed');
      addToast({ type: 'error', title: msg });
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
      addToast({ type: 'success', title: t('settings.jre.toast.downloaded', { version: String(jreDownloadVersion) }) });
      api
        .listDownloadedJres()
        .then(setDownloadedJres)
        .catch(() => {});
      api
        .findAllJava()
        .then(setJavaList)
        .catch(() => {});
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('settings.jre.toast.downloadFailed'), message: formatError(e) });
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
      addToast({ type: 'success', title: t('settings.saved') });
    } catch (e: unknown) {
      const msg = formatError(e) || t('settings.saveFailed');
      setError(msg);
      addToast({ type: 'error', title: msg });
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
      /* empty */
    }
  };

  const handleCopyGcArgs = async (gcType: string, args: string[]) => {
    try {
      await navigator.clipboard.writeText(args.join(' '));
      setGcCopied((prev) => ({ ...prev, [gcType]: true }));
      setTimeout(() => setGcCopied((prev) => ({ ...prev, [gcType]: false })), 2000);
    } catch {
      /* empty */
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
      /* empty */
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

  const sectionKeywords: Record<string, string[]> = useMemo(() => ({
    'sec-account': [t('settings.account'), 'account', 'login', 'microsoft', 'offline', t('settings.logout')],
    'sec-about': [t('settings.about.title') || 'about', 'update', 'version', 'check update', t('settings.about.checkForUpdates') || 'check for updates'],
    'sec-troubleshoot': [t('settings.troubleshoot.title') || 'troubleshoot', 'repair', 'fix', 'cache', 'reset', 'diagnose'],
    'sec-skin-station': ['skin', t('settings.skinStation')],
    'sec-language': [t('settings.language'), 'language', 'i18n', 'locale'],
    'sec-theme': [t('settings.theme'), 'theme', 'dark', 'light', 'oled'],
    'sec-font-custom': [t('settings.fontCustom'), 'font'],
    'sec-guide': [t('settings.guide'), 'guide', 'onboarding'],
    'sec-java': [t('settings.javaPath'), 'java', 'jvm', 'jdk', 'runtime'],
    'sec-jre-management': [t('settings.jreManagement'), 'jre', 'download java'],
    'sec-memory': [t('settings.memory'), 'memory', 'ram', 'heap'],
    'sec-gc-tuning': [t('settings.gcTuning'), 'gc', 'garbage', 'zgc', 'g1gc', 'shenandoah'],
    'sec-disk-usage': [t('settings.diskUsage'), 'disk', 'storage', t('settings.cleanup')],
    'sec-file-mgmt': [t('settings.fileManagement'), 'file', 'manage', 'versions'],
    'sec-launch-behavior': [t('settings.launchBehavior'), 'launch', 'start', 'auto close'],
    'sec-data-dir': [t('settings.dataDirectory'), 'directory', 'path', 'game dir'],
    'sec-dynamic-bg': [t('settings.dynamicBackground'), 'background', 'wallpaper', 'bg'],
    'sec-sound-themes': [t('settings.soundThemes'), 'sound', 'audio', 'sfx'],
    'sec-window-effects': [t('settings.windowEffects'), 'window', 'effects', 'animation'],
    'sec-mini-mode': [t('settings.miniMode'), 'mini', 'compact', 'overlay'],
    'sec-hardware': [t('settings.hardware'), 'hardware', 'cpu', 'gpu', 'system'],
    'sec-battery': [t('settings.battery'), 'battery', 'power'],
    'sec-download': [t('settings.download'), 'download', 'source', 'mirror', 'bmclapi', 'mcbbs', 'speed', 'priority'],
    'sec-network': [t('settings.network') || 'Network', 'network', 'github', 'proxy', 'git', 'mirror', 'gh-proxy'],
    'sec-discord': [t('settings.discord'), 'discord', 'rpc', 'rich presence'],
    'sec-accessibility': [t('settings.accessibility'), 'accessibility', 'colorblind', 'a11y'],
    'sec-screenshots': [t('settings.screenshots'), 'screenshot', 'capture'],
    'sec-security-overview': [t('settings.securityOverview'), 'security', 'score'],
    'sec-credential-protection': [t('settings.credentialProtection'), 'credential', 'encrypt', 'password'],
    'sec-network-security': [t('settings.networkSecurity'), 'network', 'proxy', 'ssl', 'tls'],
    'sec-launch-security': [t('settings.launchSecurity'), 'sandbox', 'jvm whitelist', 'launch security'],
    'sec-api-key-management': [t('settings.apiKeyManagement'), 'api key', 'curseforge', 'cf key'],
    'sec-trusted-keys': [t('settings.security.trustedKeys'), 'trusted key', 'signature', 'ed25519', 'plugin signature'],
    'sec-security-audit': [t('settings.securityAudit'), 'audit', 'log'],
    'sec-ai-assistant': [t('settings.aiAssistant'), 'ai', 'assistant', 'chat'],
    'sec-achievements': [t('settings.achievements'), 'achievement', 'unlock'],
  }), [t]);

  useEffect(() => {
    if (!settingsSearch.trim()) return;
    const query = settingsSearch.toLowerCase().trim();
    for (const [sectionId, keywords] of Object.entries(sectionKeywords)) {
      const matched = keywords.some((kw) => kw.toLowerCase().includes(query));
      if (matched) {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.outline = '2px solid var(--color-accent)';
          el.style.outlineOffset = '4px';
          el.style.transition = 'outline 0.3s ease';
          setTimeout(() => {
            el.style.outline = 'none';
          }, 2000);
        }
        break;
      }
    }
  }, [settingsSearch, sectionKeywords]);

  const navCategories: NavCategory[] = useMemo(
    () => [
      {
        id: 'general',
        label: t('settings.nav.general'),
        sectionIds: ['sec-account', 'sec-about', 'sec-troubleshoot', 'sec-skin-station', 'sec-language', 'sec-theme', 'sec-font-custom', 'sec-guide'],
      },
      {
        id: 'performance',
        label: t('settings.nav.performance'),
        sectionIds: [
          'sec-java',
          'sec-jre-management',
          'sec-memory',
          'sec-gc-tuning',
          'sec-disk-usage',
          'sec-file-mgmt',
        ],
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
        sectionIds: ['sec-hardware', 'sec-battery', 'sec-download', 'sec-network'],
      },
      {
        id: 'social',
        label: t('settings.nav.social'),
        sectionIds: ['sec-discord', 'sec-accessibility', 'sec-screenshots'],
      },
      {
        id: 'security',
        label: t('settings.nav.security'),
        sectionIds: [
          'sec-security-overview',
          'sec-credential-protection',
          'sec-network-security',
          'sec-launch-security',
          'sec-api-key-management',
          'sec-trusted-keys',
          'sec-security-audit',
        ],
      },
      {
        id: 'ai',
        label: t('settings.nav.ai'),
        sectionIds: ['sec-ai-assistant'],
      },
      {
        id: 'achievements',
        label: t('settings.nav.achievements'),
        sectionIds: ['sec-achievements'],
      },
      {
        id: 'plugins',
        label: t('settings.nav.plugins') || 'Plugins',
        sectionIds: ['sec-plugins'],
      },
    ],
    [t],
  );

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.searchBox}>
          <Icon name="search" size={14} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('settings.searchPlaceholder')}
            value={settingsSearch}
            onChange={(e) => setSettingsSearch(e.target.value)}
          />
          {settingsSearch && (
            <button className={styles.searchClear} onClick={() => setSettingsSearch('')}>
              ✕
            </button>
          )}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => setLocalConfig(config)}>
            {t('settings.reset')}
          </Button>
          <Button variant="primary" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? (
              t('settings.saving')
            ) : saved ? (
              <>
                {' '}
                <Icon name="check" size={12} /> {t('settings.saved')}
              </>
            ) : (
              t('settings.save')
            )}
          </Button>
        </div>
      </div>

      <SettingsNav categories={navCategories} />

      <SectionCard id="sec-account" title={t('settings.account')}>
        <div className={styles.accountRow}>
          <StatusDot status="ready" />
          <span className={styles.accountName}>{auth.username}</span>
          <Badge variant="default">
            {authState.accounts
              .find((a: StoredAccount) => a.id === authState.activeAccountId)
              ?.account_type?.toUpperCase() || 'OFFLINE'}
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
              {authState.accounts.map((acct: StoredAccount) => (
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

      <AboutSection />

      {/* 诊断与修复：清理缓存、重置布局、重新加载 */}
      <SectionCard id="sec-troubleshoot" title={t('settings.troubleshoot.title')}>
        <div style={{ fontSize: '0.6em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
          {t('settings.troubleshoot.desc')}
        </div>
        <SettingRow label={t('settings.troubleshoot.clearCache')} description={t('settings.troubleshoot.clearCacheDesc')}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              try {
                // 清理 API 缓存和插件状态相关的 localStorage，保留账号和实例配置
                const keysToKeep = new Set<string>();
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && (key.startsWith('bonnext:auth') || key.startsWith('bonnext:config') || key.startsWith('bonnext:instances'))) {
                    keysToKeep.add(key);
                  }
                }
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && !keysToKeep.has(key) && key.startsWith('bonnext:')) {
                    keysToRemove.push(key);
                  }
                }
                keysToRemove.forEach((k) => localStorage.removeItem(k));
                addToast({ type: 'success', title: t('settings.troubleshoot.clearCacheSuccess') });
              } catch (e) {
                addToast({ type: 'error', title: String(e) });
              }
            }}
          >
            {t('settings.troubleshoot.clearCache')}
          </Button>
        </SettingRow>
        <SettingRow label={t('settings.troubleshoot.resetLayout')} description={t('settings.troubleshoot.resetLayoutDesc')}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              try {
                // 重置界面布局相关的 localStorage 键
                const layoutKeys = [
                  'bonnext:theme', 'bonnext:ui-scale', 'bonnext:auto-scale',
                  'bonnext:animation-speed', 'bonnext:animation-duration',
                  'bonnext:layout-style', 'bonnext:sidebar-width', 'bonnext:density',
                  'bonnext:auto-day-night', 'bonnext:home-mode', 'bonnext:home-background',
                ];
                layoutKeys.forEach((k) => localStorage.removeItem(k));
                addToast({ type: 'success', title: t('settings.troubleshoot.resetLayoutSuccess') });
              } catch (e) {
                addToast({ type: 'error', title: String(e) });
              }
            }}
          >
            {t('settings.troubleshoot.resetLayout')}
          </Button>
        </SettingRow>
        <SettingRow label={t('settings.troubleshoot.reloadApp')} description={t('settings.troubleshoot.reloadAppDesc')}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (window.confirm(t('settings.troubleshoot.confirmReload'))) {
                window.location.reload();
              }
            }}
          >
            {t('settings.troubleshoot.reloadApp')}
          </Button>
        </SettingRow>
      </SectionCard>

      <SkinStationSection addToast={addToast} />

      <SectionCard id="sec-java" title={t('settings.java')}>
        <SettingRow label={t('settings.javaVersion')}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ContextHelp
                content={t('settings.javaPathHelp')}
              />
            </div>
            {recommendedConfig?.detected_java_path && (
              <div className={styles.autoDetectedRow} style={{ marginBottom: 8 }}>
                <Badge variant="accent">{t('settings.autoDetected')}</Badge>
                <span className={styles.autoDetectedPath}>
                  {recommendedConfig.detected_java_path.split(/[/\\]/).slice(-3).join('/')}
                </span>
                {recommendedConfig.detected_java_version && (
                  <Badge variant="default">Java {recommendedConfig.detected_java_version}</Badge>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.redetectBtn}
                  onClick={() => {
                    api
                      .getRecommendedConfig()
                      .then((rec) => {
                        setRecommendedConfig(rec);
                        if (rec.detected_java_path) {
                          api
                            .findAllJava()
                            .then(setJavaList)
                            .catch(() => {});
                        }
                      })
                      .catch(() => {});
                  }}
                >
                  {t('settings.redetect')}
                </Button>
              </div>
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className={formStyles.fieldWrapper}>
                <input
                  className={`${formStyles.input} ${javaPathField.error ? formStyles.inputHasError : ''}`}
                  value={localConfig.java_path || ''}
                  onChange={(e) => {
                    setLocalConfig({ ...localConfig, java_path: e.target.value || null });
                    javaPathField.setValue(e.target.value);
                  }}
                  onBlur={javaPathField.onBlur}
                  placeholder="/path/to/java"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={handleBrowseJava}>
                {t('settings.browse')}
              </Button>
            </div>
            {javaPathField.error && <div className={formStyles.errorText}>{javaPathField.error}</div>}
          </div>
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
                    clipPath: 'var(--clip-small)',
                    cursor: 'pointer',
                    letterSpacing: 0.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Java {v}
                  {downloadedJres.includes(v) ? <Icon name="check" size={12} /> : null}
                </button>
              ))}
            </div>
            {jreAvailableVersions.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.55em', color: 'var(--color-text-muted)' }}>
                {t('settings.jre.releasesAvailable', { count: String(jreAvailableVersions.length) })}
                {jreAvailableVersions[0]?.size_mb.toFixed(0)} MB)
              </div>
            )}
            {jreDownloading && jreDownloadProgress && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{ height: 4, background: 'var(--color-border-light)', clipPath: 'var(--clip-badge)', overflow: 'hidden' }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${jreDownloadProgress.total > 0 ? (jreDownloadProgress.downloaded / jreDownloadProgress.total) * 100 : 0}%`,
                      background: 'var(--color-accent)',
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
                  ? t('common.downloading')
                  : t('settings.jre.downloadVersion', { version: String(jreDownloadVersion) })}
              </Button>
            </div>
          </div>
        </SettingRow>

        <SettingRow label={t('settings.jvmArgs')}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ContextHelp
                content={
                  t('settings.jvmArgsHelp') ||
                  'JVM arguments control how Java runs Minecraft. Common flags: -XX:+UseG1GC (garbage collector), -XX:+ParallelRefProcEnabled (faster ref processing). Use presets for safe defaults.'
                }
              />
            </div>
            <JVMPresets
              activePresetId={activePresetId}
              onSelectPreset={(preset: JVMPreset) => {
                setActivePresetId(preset.id);
                setLocalConfig({ ...localConfig, jvm_args: preset.args.join(' ') });
              }}
            />
            <div style={{ marginTop: 10 }}>
              <TextInput
                value={localConfig.jvm_args || ''}
                onChange={(e) => {
                  setLocalConfig({ ...localConfig, jvm_args: e.target.value || null });
                  setActivePresetId(null);
                }}
                placeholder="-Xmx4G -XX:+UseG1GC -XX:+ParallelRefProcEnabled"
              />
            </div>
          </div>
        </SettingRow>
      </SectionCard>

      <JreManagementSection addToast={addToast} />

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
      <ShellManagementSection />
      <SectionCard id="sec-plugins" title={t('settings.nav.plugins') || 'Plugins'}>
        <PluginManagementSection />
      </SectionCard>

      {pluginSettingsSections.map((section) => {
        const LazyComponent = pluginSettingsComponents[section.id];
        return (
          <SectionCard key={section.id} id={`sec-plugin-${section.id}`} title={section.label}>
            <PluginErrorBoundary pluginId={section.pluginId}>
              <Suspense fallback={<div>{t('common.loading')}</div>}>
                {LazyComponent && <LazyComponent />}
              </Suspense>
            </PluginErrorBoundary>
          </SectionCard>
        );
      })}

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
              navigate('/home');
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
                  <span className={styles.screenshotRow__date}>{formatDate(ss.modified)}</span>
                  <Button variant="secondary" size="sm" onClick={() => api.openFolder(ss.path)}>
                    {t('common.openFolder')}
                  </Button>
                </div>
              ))}
            </div>
          ))}
      </SectionCard>

      <SectionCard id="sec-security-overview" title={t('settings.security.overview')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5em', marginBottom: '0.8em' }}>
          <SecurityScore score={securityScore} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4em', fontSize: '0.55em' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={encryptionStatus.encrypted ? 'ready' : 'error'} />
                <span>{t('settings.security.credentialEncryption')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.strict_verification ? 'ready' : 'inactive'} />
                <span>{t('settings.security.strictVerification')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.jvm_args_mode === 'whitelist' ? 'ready' : 'inactive'} />
                <span>{t('settings.security.jvmWhitelist')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.audit_log_enabled ? 'ready' : 'inactive'} />
                <span>{t('settings.security.auditLogShort')}</span>
              </div>
            </div>
          </div>
        </div>
        <SettingRow label={t('settings.security.oneClickFix')}>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                // 1. 修复文件权限
                await api.fixFilePermissions();
                // 2. 若存在明文凭据，迁移到加密存储
                if (encryptionStatus.plain && !encryptionStatus.encrypted) {
                  try {
                    await api.migrateCredentials();
                    const status = await api.getEncryptionStatus();
                    setEncryptionStatus(status);
                  } catch (e) {
                    // 迁移失败不阻断后续步骤
                    console.warn('credential migration failed', e);
                  }
                }
                // 3. 自动开启审计日志 + JVM 白名单 + 严格校验（若未开启）
                // 关键修复：直接构造更新后的 config 并持久化，避免 handleConfigChange 异步状态更新导致 handleSave 保存旧值
                const sec = localConfig.security;
                if (sec && (!sec.audit_log_enabled || sec.jvm_args_mode !== 'whitelist' || !sec.strict_verification)) {
                  const updatedConfig: AppConfig = {
                    ...localConfig,
                    security: {
                      ...sec,
                      audit_log_enabled: true,
                      jvm_args_mode: 'whitelist',
                      strict_verification: true,
                    },
                  };
                  setLocalConfig(updatedConfig);
                  await saveConfig(updatedConfig);
                }
                // 4. 刷新安全评分
                const score = await api.getSecurityScore();
                setSecurityScore(score);
                addToast({ type: 'success', title: t('settings.security.fixSuccess') });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                addToast({ type: 'error', title: t('settings.security.fixFailed'), message: msg });
              }
            }}
          >
            {t('settings.security.fixSecurityIssues')}
          </Button>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-credential-protection" title={t('settings.security.credentialProtection')}>
        <SettingRow label={t('settings.security.credentialEncryptionStorage')}>
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
              {t('settings.security.aesEncryptionDesc')}
            </span>
          </label>
        </SettingRow>
        <SettingRow label={t('settings.security.encryptionStatus')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.55em' }}>
            <StatusDot status={encryptionStatus.encrypted ? 'ready' : 'inactive'} />
            <span>
              {encryptionStatus.encrypted
                ? t('settings.security.encrypted')
                : encryptionStatus.plain
                  ? t('settings.security.plainTextInsecure')
                  : t('settings.security.noCredentials')}
            </span>
          </div>
        </SettingRow>
        {encryptionStatus.plain && !encryptionStatus.encrypted && (
          <SettingRow label={t('settings.security.migration')}>
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
              {t('settings.security.migrateToEncrypted')}
            </Button>
          </SettingRow>
        )}
      </SectionCard>

      <SectionCard id="sec-network-security" title={t('settings.security.networkSecurity')}>
        <SettingRow label={t('settings.security.strictDownloadVerification')}>
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
              {t('settings.security.rejectNoHash')}
            </span>
          </label>
        </SettingRow>
        <SettingRow label={t('settings.security.enforceHttps')}>
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
              {t('settings.security.httpsOnly')}
            </span>
          </label>
        </SettingRow>
        <SettingRow label={t('settings.security.enableProxy')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ContextHelp
              content={
                t('settings.proxyHelp') ||
                'Route all downloads and network requests through a proxy server. Supported formats: socks5://host:port, http://host:port. Useful in regions with restricted access.'
              }
            />
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
          </div>
        </SettingRow>
        {(localConfig.security?.proxy_enabled ?? false) && (
          <SettingRow label={t('settings.security.proxyUrl')}>
            <div className={formStyles.fieldWrapper}>
              <input
                className={`${formStyles.input} ${proxyUrlField.error ? formStyles.inputHasError : ''}`}
                value={localConfig.security?.proxy_url || ''}
                onChange={(e) => {
                  handleConfigChange({
                    security: { ...localConfig.security!, proxy_url: e.target.value || null },
                  });
                  proxyUrlField.setValue(e.target.value);
                }}
                onBlur={proxyUrlField.onBlur}
                placeholder="socks5://127.0.0.1:1080"
              />
              {proxyUrlField.error && <div className={formStyles.errorText}>{proxyUrlField.error}</div>}
            </div>
          </SettingRow>
        )}
      </SectionCard>

      <SectionCard id="sec-launch-security" title={t('settings.security.launchSecurity')}>
        <SettingRow label={t('settings.security.jvmArgsMode')}>
          <Select
            value={localConfig.security?.jvm_args_mode || 'whitelist'}
            onChange={(e) =>
              handleConfigChange({
                security: { ...localConfig.security!, jvm_args_mode: e.target.value },
              })
            }
            options={[
              { value: 'whitelist', label: t('settings.security.jvmWhitelistRecommended') },
              { value: 'custom', label: t('settings.security.jvmCustomInsecure') },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('settings.security.sandboxMode')}>
          <Select
            value={localConfig.security?.sandbox_mode || 'off'}
            onChange={(e) =>
              handleConfigChange({
                security: { ...localConfig.security!, sandbox_mode: e.target.value },
              })
            }
            options={[
              { value: 'off', label: t('settings.security.sandboxOff') },
              { value: 'basic', label: t('settings.security.sandboxBasic') },
              { value: 'strict', label: t('settings.security.sandboxStrict') },
            ]}
          />
        </SettingRow>
        {sandboxInfo && !sandboxInfo.available && localConfig.security?.sandbox_mode !== 'off' && (
          <div style={{ fontSize: '0.5em', color: '#ffaa00', padding: '0.3em 0' }}>
            <>
              <Icon name="warning" size={14} />{' '}
              {t('settings.security.sandboxUnavailable', { tool: sandboxInfo.tool || 'firejail/sandbox-exec' })}
            </>
          </div>
        )}
        <SettingRow label={t('settings.security.secureLaunchCheck')}>
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
              {t('settings.security.secureLaunchCheckDesc')}
            </span>
          </label>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-api-key-management" title={t('settings.security.apiKeyManagement')}>
        <SettingRow label={t('settings.security.curseforgeApiKey')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showCfKey ? 'text' : 'password'}
                value={cfKeyValue}
                onChange={(e) => setCfKeyValue(e.target.value)}
                placeholder={
                  cfKeyStatus?.configured
                    ? t('settings.security.cfKeyConfigured')
                    : t('settings.security.cfKeyPlaceholder')
                }
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
                {showCfKey ? t('common.hide') : t('common.show')}
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
                {t('common.save')}
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
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </div>
        </SettingRow>
        <SettingRow label={t('settings.security.keyStatus')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.55em' }}>
            <StatusDot status={cfKeyStatus?.configured ? 'ready' : 'inactive'} />
            <span>
              {cfKeyStatus?.configured
                ? t('settings.security.configuredSource', { source: cfKeyStatus.source })
                : t('settings.security.notConfigured')}
            </span>
          </div>
        </SettingRow>
      </SectionCard>

      <TrustedKeysSection />

      <SectionCard id="sec-security-audit" title={t('settings.security.securityAudit')}>
        <SettingRow label={t('settings.security.auditLogShort')}>
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
              {t('settings.security.recordAuditLog')}
            </span>
          </label>
        </SettingRow>
        <SettingRow label={t('settings.security.viewAuditLog')}>
          <Button variant="secondary" size="sm" onClick={() => setAuditLogOpen(true)}>
            {t('settings.security.openLogViewer')}
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
              {t('settings.security.recentLogins')}
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
      <NetworkSection t={t} addToast={addToast} />
      <AISection />

      <SectionCard id="sec-achievements" title={t('settings.nav.achievements')}>
        <AchievementDisplay />
      </SectionCard>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.footer}>
        <div className={styles.footer__recruit}>
          {t('settings.recruitNotice')}
        </div>
        <span className={styles.footer__brand}>{t('settings.nowintPresent')}</span>
        <a
          href="https://qun.qq.com/universal-share/share?ac=1&authKey=nRLO82GV%2FbYhC6GleAK72oZY%2Fhs4Vz2qh2OcS%2BawOildd0nySW9wLWCJg%2BLpS0%2BG&busi_data=eyJncm91cENvZGUiOiIxMDE2NjQxNjkxIiwidG9rZW4iOiJMQjR0cWZLcGFNcW9nSVJCOVQ3LzZ1Y1o4V0wrd1ljZTJVaWhSdUFUbDRKWGZaNExqSTZSMUdTMk04UUdCc2IvIiwidWluIjoiNjc0MDAwMjQ5In0%3D&data=u5JO0vDgzgicnHsVlwKbrFSyvCXZpH1vmPTkcluZ8ApBfyg1DFU1uQ-SCpXFFvvFWqsr8fHFId9keRmqUjXl1A&svctype=4&tempid=h5_group_info"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footer__qqBtn}
        >
          {t('settings.joinQQGroup')}
        </a>
      </div>

      {confirmDeleteVersion && (
        <Modal
          open
          title={t('settings.fileMgmt.deleteConfirm', { version: confirmDeleteVersion })}
          onClose={() => setConfirmDeleteVersion(null)}
          children={<p>{t('settings.fileMgmt.deleteConfirmMsg') || 'This action cannot be undone.'}</p>}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteVersion(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => executeDeleteVersion(confirmDeleteVersion)}>
                {t('settings.fileMgmt.delete')}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
