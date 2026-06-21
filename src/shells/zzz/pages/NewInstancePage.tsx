import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type VersionEntry, type GameInstance, type DetectedLauncher, type MigrateableInstance } from '../../../shared/api';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useI18n } from '../../../shared/i18n';
import { useToast } from '../../../shared/stores/toastStore';
import { formatError } from '../../../shared/utils/errorMapping';
import { SectionHeader, SubLabel } from '../components/layout';
import { Button, TextInput, Select, Badge } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './NewInstancePage.module.css';

interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  loaderType: string;
}

const getTemplates = (t: (key: string) => string): Template[] => [
  {
    id: 'vanilla',
    name: t('newInstance.templateVanilla'),
    icon: '\u{1F4E6}',
    description: t('newInstance.templateVanillaDesc'),
    loaderType: '',
  },
  {
    id: 'fabric',
    name: t('newInstance.templateFabric'),
    icon: '\u{1F9F5}',
    description: t('newInstance.templateFabricDesc'),
    loaderType: 'fabric',
  },
  {
    id: 'forge',
    name: t('newInstance.templateForge'),
    icon: '\u{2692}',
    description: t('newInstance.templateForgeDesc'),
    loaderType: 'forge',
  },
  {
    id: 'neoforge',
    name: t('newInstance.templateNeoForge'),
    icon: '\u{1F525}',
    description: t('newInstance.templateNeoForgeDesc'),
    loaderType: 'neoforge',
  },
  {
    id: 'quilt',
    name: t('newInstance.templateQuilt'),
    icon: '\u{1FAF6}',
    description: t('newInstance.templateQuiltDesc'),
    loaderType: 'quilt',
  },
  {
    id: 'optifine',
    name: t('newInstance.templateOptifine'),
    icon: '\u{1F50D}',
    description: t('newInstance.templateOptifineDesc'),
    loaderType: 'forge',
  },
];

type VersionFilter = 'all' | 'release' | 'snapshot' | 'old_beta';

export default function NewInstancePage() {
  const navigate = useNavigate();
  const { createInstance } = useInstances();
  const { t } = useI18n();
  const { addToast } = useToast();
  const TEMPLATES = getTemplates(t);
  const [name, setName] = useState('');
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loaderType, setLoaderType] = useState('');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [optifineNote, setOptifineNote] = useState(false);
  const [detectedLaunchers, setDetectedLaunchers] = useState<DetectedLauncher[]>([]);
  const [selectedLauncher, setSelectedLauncher] = useState<DetectedLauncher | null>(null);
  const [launcherInstances, setLauncherInstances] = useState<MigrateableInstance[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [migrating, setMigrating] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState('');

  // 版本列表加载状态（HMCL 风格三态：loading/empty/error/data）
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [versionsError, setVersionsError] = useState('');
  const [versionFilter, setVersionFilter] = useState<VersionFilter>('release');
  const [versionSearch, setVersionSearch] = useState('');

  // 高级设置（参考 HMCL 实例创建向导的可选配置）
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [description, setDescription] = useState('');
  const [maxMemory, setMaxMemory] = useState(2048);
  const [minMemory, setMinMemory] = useState(512);
  const [javaPath, setJavaPath] = useState('');
  const [jvmArgs, setJvmArgs] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [tags, setTags] = useState('');
  const [iconPath, setIconPath] = useState<string | null>(null);

  const loadVersions = () => {
    setVersionsLoading(true);
    setVersionsError('');
    api
      .getVersions()
      .then((v) => {
        setVersions(v);
        // 默认选中最新正式版（HMCL 行为）
        const firstRelease = v.find((ver) => ver.type === 'release');
        const first = firstRelease || v[0];
        if (first) {
          setSelectedVersion(first.id);
          setSelectedUrl(first.url);
        }
      })
      .catch((e: unknown) => {
        setVersionsError(formatError(e) || t('newInstance.versionLoadFailed'));
      })
      .finally(() => setVersionsLoading(false));
  };

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 按类型 + 搜索过滤版本列表（HMCL 风格）
  const filteredVersions = useMemo(() => {
    let list = versions;
    if (versionFilter === 'release') {
      list = list.filter((v) => v.type === 'release');
    } else if (versionFilter === 'snapshot') {
      list = list.filter((v) => v.type === 'snapshot');
    } else if (versionFilter === 'old_beta') {
      list = list.filter((v) => v.type === 'old_beta' || v.type === 'old_alpha');
    }
    if (versionSearch.trim()) {
      const q = versionSearch.trim().toLowerCase();
      list = list.filter((v) => v.id.toLowerCase().includes(q));
    }
    return list;
  }, [versions, versionFilter, versionSearch]);

  useEffect(() => {
    if (loaderType) {
      api
        .getLoaderVersions(loaderType)
        .then(setLoaderVersions)
        .catch(() => setLoaderVersions([]));
    } else {
      setLoaderVersions([]);
    }
  }, [loaderType]);

  const selectTemplate = (template: Template) => {
    setActiveTemplate(template.id);
    setLoaderType(template.loaderType);
    setLoaderVersion('');
    setOptifineNote(template.id === 'optifine');
    if (!name.trim()) {
      setName(template.name);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t('newInstance.requireName'));
      return;
    }
    if (!selectedVersion) {
      setError(t('newInstance.requireVersion'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const inst: GameInstance = {
        id: `${selectedVersion}_${name.replace(/\s+/g, '_')}_${Date.now()}`,
        name: name.trim(),
        version_id: selectedVersion,
        version_url: selectedUrl,
        loader_type: loaderType || null,
        loader_version: loaderVersion || null,
        description: description.trim(),
        max_memory: maxMemory,
        min_memory: minMemory,
        java_path: javaPath.trim() || null,
        jvm_args: jvmArgs.trim() || null,
        created_at: new Date().toISOString(),
        last_played: null,
        playtime_seconds: 0,
        uses_global_config: false,
        window_width: 0,
        window_height: 0,
        fullscreen: false,
        debug_mode: false,
        debug_port: 5005,
        icon: iconPath,
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        server_address: serverAddress.trim() || null,
        game_dir_type: 'version',
        custom_game_dir: null,
        pre_launch_command: null,
        post_exit_command: null,
        environment_variables: null,
        process_priority: 'normal',
      };
      await createInstance(inst);
      addToast({ type: 'success', title: t('newInstance.createSuccess', { name: name.trim() }) });
      if (iconPath) {
        try {
          await api.setInstanceIcon(inst.id, iconPath);
        } catch {
          /* 图标设置失败不阻断创建流程 */
        }
      }
      if (loaderType && loaderVersion) {
        try {
          await api.installLoader(loaderType, selectedVersion, selectedUrl, loaderVersion, inst.id);
        } catch (e: unknown) {
          setError(t('newInstance.loaderInstallFailed', { error: formatError(e) }));
          addToast({ type: 'error', title: t('newInstance.loaderInstallFailed', { error: formatError(e) }) });
          return;
        }
      }
      // HMCL-style: 创建后跳转到实例详情页
      navigate(`/instances/${inst.id}`);
    } catch (e: unknown) {
      const msg = formatError(e) || t('newInstance.createFailed');
      setError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setLoading(false);
    }
  };

  const handlePickIcon = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }],
      });
      if (selected && typeof selected === 'string') {
        setIconPath(selected);
      }
    } catch {
      /* 用户取消 */
    }
  };

  const handleDetectLaunchers = async () => {
    setDetecting(true);
    setMigrationError('');
    setSelectedLauncher(null);
    setLauncherInstances([]);
    try {
      const launchers = await api.detectLaunchers();
      setDetectedLaunchers(launchers);
      if (launchers.length === 0) {
        setMigrationError(t('newInstance.noLaunchersFound'));
        addToast({ type: 'info', title: t('newInstance.noLaunchersFound') });
      } else {
        addToast({ type: 'success', title: t('newInstance.detectSuccess', { count: String(launchers.length) }) });
      }
    } catch (e: unknown) {
      const msg = formatError(e) || t('newInstance.detectFailed');
      setMigrationError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setDetecting(false);
    }
  };

  const handleSelectLauncher = async (launcher: DetectedLauncher) => {
    setSelectedLauncher(launcher);
    setScanning(true);
    setLauncherInstances([]);
    setMigrationError('');
    try {
      const instances = await api.scanLauncherInstances(launcher.launcher_type, launcher.game_dir);
      setLauncherInstances(instances);
      if (instances.length === 0) {
        setMigrationError(t('newInstance.noInstancesFound'));
      }
    } catch (e: unknown) {
      const msg = formatError(e) || t('newInstance.scanFailed');
      setMigrationError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setScanning(false);
    }
  };

  const handleMigrateInstance = async (inst: MigrateableInstance) => {
    setMigrating(inst.name);
    setMigrationError('');
    try {
      const migrated = await api.migrateInstance({
        name: inst.name,
        versionId: inst.version_id,
        loaderType: inst.loader_type,
        loaderVersion: inst.loader_version,
        sourceGameDir: inst.game_dir,
        launcherType: inst.launcher_type,
        javaPath: inst.java_path,
        jvmArgs: inst.jvm_args,
        minMemory: inst.min_memory,
        maxMemory: inst.max_memory,
      });
      addToast({ type: 'success', title: t('newInstance.migrateSuccess', { name: inst.name }) });
      // HMCL-style: 迁移后跳转到实例详情页
      navigate(`/instances/${migrated.id}`);
    } catch (e: unknown) {
      const msg = formatError(e) || t('newInstance.migrateFailed');
      setMigrationError(msg);
      addToast({ type: 'error', title: msg });
    } finally {
      setMigrating(null);
    }
  };

  const canCreate = !loading && name.trim().length > 0 && selectedVersion.length > 0 && !versionsLoading;

  return (
    <div>
      <SectionHeader title={t('instances.create').toUpperCase()} />
      <div className={styles.form}>
        {/* Template cards */}
        <div>
          <SubLabel>{t('newInstance.template')}</SubLabel>
          <div className={styles.templateGrid}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`${styles.templateCard} ${activeTemplate === tpl.id ? styles.templateCardActive : ''}`}
                onClick={() => selectTemplate(tpl)}
              >
                <span className={styles.templateIcon}>{tpl.icon}</span>
                <span className={styles.templateName}>{tpl.name}</span>
                <span className={styles.templateDesc}>{tpl.description}</span>
              </button>
            ))}
          </div>
        </div>

        {optifineNote && (
          <div className={styles.optifineNote}>
            <span>{t('newInstance.optifineNote')}</span>
          </div>
        )}

        {/* Name */}
        <div data-tour="new-name">
          <SubLabel>{t('newInstance.instanceName')}</SubLabel>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('newInstance.namePlaceholder')}
          />
        </div>

        {/* Version selector with filter + search + three-state UI (HMCL-style) */}
        <div data-tour="new-version">
          <SubLabel>{t('newInstance.version')}</SubLabel>

          {/* 过滤器与搜索框 */}
          <div className={styles.versionToolbar}>
            <div className={styles.versionFilterGroup}>
              {(['all', 'release', 'snapshot', 'old_beta'] as VersionFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.versionFilterBtn} ${versionFilter === f ? styles.versionFilterBtnActive : ''}`}
                  onClick={() => setVersionFilter(f)}
                >
                  {t(`newInstance.versionFilter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                </button>
              ))}
            </div>
            <TextInput
              value={versionSearch}
              onChange={(e) => setVersionSearch(e.target.value)}
              placeholder={t('newInstance.versionSearchPlaceholder')}
              className={styles.versionSearch}
            />
          </div>

          {/* 三态显示 */}
          {versionsLoading && (
            <div className={styles.versionStatus}>
              <Icon name="loader" size={14} />
              <span>{t('newInstance.versionLoading')}</span>
            </div>
          )}

          {!versionsLoading && versionsError && (
            <div className={styles.versionError}>
              <Icon name="warning" size={14} />
              <span>{versionsError}</span>
              <Button variant="secondary" size="sm" onClick={loadVersions}>
                {t('newInstance.versionRetry')}
              </Button>
            </div>
          )}

          {!versionsLoading && !versionsError && filteredVersions.length === 0 && (
            <div className={styles.versionStatus}>
              <Icon name="info" size={14} />
              <span>{t('newInstance.versionEmpty')}</span>
            </div>
          )}

          {!versionsLoading && !versionsError && filteredVersions.length > 0 && (
            <Select
              value={selectedVersion}
              onChange={(e) => {
                setSelectedVersion(e.target.value);
                const v = versions.find((ver) => ver.id === e.target.value);
                if (v) setSelectedUrl(v.url);
              }}
              options={filteredVersions.map((v) => ({
                value: v.id,
                label: v.type === 'release' ? v.id : `${v.id} (${v.type})`,
              }))}
            />
          )}
        </div>

        {/* Loader selector */}
        <div>
          <SubLabel>{t('newInstance.modLoader')}</SubLabel>
          <Select
            value={loaderType}
            onChange={(e) => {
              setLoaderType(e.target.value);
              if (e.target.value) {
                setActiveTemplate(e.target.value === 'fabric' ? 'fabric' : 'forge');
                setOptifineNote(false);
              } else {
                setActiveTemplate('vanilla');
                setOptifineNote(false);
              }
            }}
            options={[
              { value: '', label: t('newInstance.noneVanilla') },
              { value: 'fabric', label: t('common.fabric') },
              { value: 'forge', label: t('common.forge') },
              { value: 'quilt', label: 'Quilt' },
              { value: 'neoforge', label: 'NeoForge' },
            ]}
          />
        </div>

        {/* Loader version */}
        {loaderType && loaderVersions.length > 0 && (
          <div>
            <SubLabel>{t('newInstance.loaderVersion')}</SubLabel>
            <Select
              value={loaderVersion}
              onChange={(e) => setLoaderVersion(e.target.value)}
              options={loaderVersions.map((v) => ({ value: v, label: v }))}
            />
          </div>
        )}

        {/* Advanced settings toggle */}
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <Icon name={showAdvanced ? 'chevronDown' : 'chevronRight'} size={12} />
          <span>{t('newInstance.advancedSettings')}</span>
          <span className={styles.advancedToggleHint}>{t('newInstance.advancedSettingsHint')}</span>
        </button>

        {showAdvanced && (
          <div className={styles.advancedPanel}>
            {/* Description */}
            <div>
              <SubLabel>{t('newInstance.description')}</SubLabel>
              <TextInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('newInstance.descriptionPlaceholder')}
              />
            </div>

            {/* Memory */}
            <div className={styles.advancedRow}>
              <div className={styles.advancedField}>
                <SubLabel>{t('newInstance.maxMemory')} (MB)</SubLabel>
                <TextInput
                  type="number"
                  value={String(maxMemory)}
                  onChange={(e) => setMaxMemory(Math.max(512, parseInt(e.target.value) || 2048))}
                />
              </div>
              <div className={styles.advancedField}>
                <SubLabel>{t('newInstance.minMemory')} (MB)</SubLabel>
                <TextInput
                  type="number"
                  value={String(minMemory)}
                  onChange={(e) => setMinMemory(Math.max(128, parseInt(e.target.value) || 512))}
                />
              </div>
            </div>

            {/* Java path */}
            <div>
              <SubLabel>{t('newInstance.javaPath')}</SubLabel>
              <TextInput
                value={javaPath}
                onChange={(e) => setJavaPath(e.target.value)}
                placeholder={t('newInstance.javaPathPlaceholder')}
              />
            </div>

            {/* JVM args */}
            <div>
              <SubLabel>{t('newInstance.jvmArgs')}</SubLabel>
              <TextInput
                value={jvmArgs}
                onChange={(e) => setJvmArgs(e.target.value)}
                placeholder={t('newInstance.jvmArgsPlaceholder')}
              />
            </div>

            {/* Server address */}
            <div>
              <SubLabel>{t('newInstance.serverAddress')}</SubLabel>
              <TextInput
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder={t('newInstance.serverAddressPlaceholder')}
              />
            </div>

            {/* Tags */}
            <div>
              <SubLabel>{t('newInstance.tags')}</SubLabel>
              <TextInput
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t('newInstance.tagsPlaceholder')}
              />
            </div>

            {/* Icon */}
            <div>
              <SubLabel>{t('newInstance.icon')}</SubLabel>
              <div className={styles.iconRow}>
                <Button variant="secondary" size="sm" onClick={handlePickIcon}>
                  <Icon name="upload" size={14} /> {t('newInstance.iconPick')}
                </Button>
                {iconPath && (
                  <span className={styles.iconPath} title={iconPath}>
                    {iconPath.split(/[\\/]/).pop()}
                  </span>
                )}
                {iconPath && (
                  <button
                    type="button"
                    className={styles.iconClear}
                    onClick={() => setIconPath(null)}
                  >
                    <Icon name="cross" size={12} />
                  </button>
                )}
              </div>
              <span className={styles.iconHint}>{t('newInstance.iconHint')}</span>
            </div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <Button
          variant="primary"
          size="lg"
          disabled={!canCreate}
          onClick={handleCreate}
          data-tour="new-create"
          title={!selectedVersion ? t('newInstance.requireVersion') : !name.trim() ? t('newInstance.requireName') : ''}
        >
          {loading ? t('newInstance.creating') : t('newInstance.create')}
        </Button>
      </div>

      <div className={styles.divider}>
        <span className={styles.dividerText}>{t('newInstance.or')}</span>
      </div>

      <div className={styles.form}>
        <SectionHeader title={t('newInstance.importTitle').toUpperCase()} />
        <div className={styles.migrationDesc}>{t('newInstance.importDesc')}</div>

        <Button
          variant="secondary"
          size="md"
          disabled={detecting}
          onClick={handleDetectLaunchers}
        >
          {detecting ? t('newInstance.detecting') : t('newInstance.detectLaunchers')}
        </Button>

        {detectedLaunchers.length > 0 && (
          <div>
            <SubLabel>{t('newInstance.detectedLaunchers')}</SubLabel>
            <div className={styles.launcherGrid}>
              {detectedLaunchers.map((launcher) => (
                <button
                  key={launcher.launcher_type}
                  type="button"
                  className={`${styles.launcherCard} ${selectedLauncher?.launcher_type === launcher.launcher_type ? styles.launcherCardActive : ''}`}
                  onClick={() => handleSelectLauncher(launcher)}
                  disabled={scanning}
                >
                  <span className={styles.launcherName}>{launcher.name}</span>
                  <Badge variant="accent">{launcher.instance_count}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {scanning && <div className={styles.scanHint}>{t('newInstance.scanning')}</div>}

        {launcherInstances.length > 0 && (
          <div>
            <SubLabel>{t('newInstance.launcherInstances')}</SubLabel>
            <div className={styles.instanceList}>
              {launcherInstances.map((inst) => (
                <div key={inst.game_dir} className={styles.migrationRow}>
                  <div className={styles.migrationInfo}>
                    <span className={styles.migrationName}>{inst.name}</span>
                    <span className={styles.migrationMeta}>
                      {inst.version_id}
                      {inst.loader_type && ` · ${inst.loader_type}${inst.loader_version ? ` ${inst.loader_version}` : ''}`}
                    </span>
                    <span className={styles.migrationMeta}>
                      {inst.size_mb > 0 ? `${inst.size_mb.toFixed(0)} MB` : ''}
                      {inst.has_mods ? ' · Mods' : ''}
                      {inst.has_saves ? ' · Saves' : ''}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={migrating !== null}
                    onClick={() => handleMigrateInstance(inst)}
                  >
                    {migrating === inst.name ? t('newInstance.migrating') : t('newInstance.importBtn')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {migrationError && <div className={styles.error}>{migrationError}</div>}
      </div>
    </div>
  );
}
