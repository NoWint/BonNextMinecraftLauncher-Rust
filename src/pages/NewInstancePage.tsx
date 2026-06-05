import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type VersionEntry, type GameInstance, type DetectedLauncher, type MigrateableInstance } from '../api';
import { useInstances } from '../shared/stores/instanceStore';
import { useI18n } from '../shared/i18n';
import { formatError } from '../shared/utils/errorMapping';
import { SectionHeader, SubLabel } from '../components/layout';
import { Button, TextInput, Select, Badge } from '../components/ui';
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
    id: 'optifine',
    name: t('newInstance.templateOptifine'),
    icon: '\u{1F50D}',
    description: t('newInstance.templateOptifineDesc'),
    loaderType: 'forge',
  },
];

export default function NewInstancePage() {
  const navigate = useNavigate();
  const { createInstance } = useInstances();
  const { t } = useI18n();
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

  useEffect(() => {
    api
      .getVersions()
      .then((v) => {
        const releases = v.filter((ver) => ver.type === 'release');
        setVersions(releases);
        if (releases.length > 0) {
          setSelectedVersion(releases[0].id);
          setSelectedUrl(releases[0].url);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loaderType) {
      api
        .getLoaderVersions(loaderType)
        .then(setLoaderVersions)
        .catch(() => {});
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
    if (!name.trim() || !selectedVersion) return;
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
        description: '',
        max_memory: 2048,
        min_memory: 512,
        java_path: null,
        jvm_args: null,
        created_at: new Date().toISOString(),
        last_played: null,
        playtime_seconds: 0,
      };
      await createInstance(inst);
      if (loaderType && loaderVersion) {
        try {
          await api.installLoader(loaderType, selectedVersion, selectedUrl, loaderVersion, inst.id);
        } catch (e: unknown) {
          setError(t('newInstance.loaderInstallFailed', { error: formatError(e) }));
          return;
        }
      }
      navigate('/');
    } catch (e: unknown) {
      setError(formatError(e) || t('newInstance.createFailed'));
    } finally {
      setLoading(false);
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
      }
    } catch (e: unknown) {
      setMigrationError(formatError(e) || t('newInstance.detectFailed'));
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
      setMigrationError(formatError(e) || t('newInstance.scanFailed'));
    } finally {
      setScanning(false);
    }
  };

  const handleMigrateInstance = async (inst: MigrateableInstance) => {
    setMigrating(inst.name);
    setMigrationError('');
    try {
      await api.migrateInstance({
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
      navigate('/');
    } catch (e: unknown) {
      setMigrationError(formatError(e) || t('newInstance.migrateFailed'));
    } finally {
      setMigrating(null);
    }
  };

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

        {/* Version selector */}
        <div data-tour="new-version">
          <SubLabel>{t('newInstance.version')}</SubLabel>
          <Select
            value={selectedVersion}
            onChange={(e) => {
              setSelectedVersion(e.target.value);
              const v = versions.find((ver) => ver.id === e.target.value);
              if (v) setSelectedUrl(v.url);
            }}
            options={versions.slice(0, 30).map((v) => ({ value: v.id, label: v.id }))}
          />
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
              options={loaderVersions.slice(0, 20).map((v) => ({ value: v, label: v }))}
            />
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <Button
          variant="primary"
          size="lg"
          disabled={loading || !name.trim()}
          onClick={handleCreate}
          data-tour="new-create"
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
