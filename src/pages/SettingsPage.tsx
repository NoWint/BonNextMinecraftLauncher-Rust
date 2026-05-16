import { useState, useEffect } from 'react';
import { api, type AppConfig } from '../api';
import { useAuth } from '../stores/authStore';
import { useConfig } from '../stores/configStore';
import { useTheme, type Theme } from '../stores/themeStore';
import { useI18n } from '../i18n';
import { StatusDot, Badge, Button, TextInput, Select, Checkbox, Slider } from '../components/ui';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './SettingsPage.module.css';

const RESOLUTION_OPTIONS = [
  { value: '854x480', label: '854 × 480' },
  { value: '1280x720', label: '1280 × 720' },
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '2560x1440', label: '2560 × 1440' },
  { value: '3840x2160', label: '3840 × 2160' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.sectionCard}>
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

export default function SettingsPage() {
  const { state: authState, logout, switchAccount } = useAuth();
  const { state: cfgState, saveConfig } = useConfig();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const auth = authState.currentUser;
  const config = cfgState.config;
  const [localConfig, setLocalConfig] = useState<AppConfig | null>(config);
  const [javaVersion, setJavaVersion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (config) setLocalConfig(config);
    api.findJava().then((p) => api.checkJavaVersion(p)).then(setJavaVersion).catch(() => {});
  }, [config]);

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

  return (
    <div className={`page-enter ${styles.page}`}>

      {/* Account section */}
      <SectionCard title={t('settings.account')}>
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
      <SectionCard title={t('settings.java')}>
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
      <SectionCard title={t('settings.memory')}>
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
      <SectionCard title={t('settings.launchBehavior')}>
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
      <SectionCard title={t('settings.dataDir')}>
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
      <SectionCard title={t('settings.theme')}>
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
                onClick={() => setTheme(val)}
              >
                {label}
              </Button>
            ))}
          </div>
        </SettingRow>
      </SectionCard>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setLocalConfig(config)}>{t('settings.reset')}</Button>
        <Button variant="primary" size="md" disabled={saving} onClick={handleSave}>
          {saving ? t('settings.saving') : saved ? '✓ ' + t('settings.saved') : t('settings.save')}
        </Button>
      </div>
    </div>
  );
}
