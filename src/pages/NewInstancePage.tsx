import { useState, useEffect } from 'react';
import { api, type VersionEntry, type GameInstance } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useI18n } from '../i18n';
import { SectionHeader, SubLabel } from '../components/layout';
import { Button, TextInput, Select } from '../components/ui';
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

  useEffect(() => {
    api.getVersions().then((v) => {
      const releases = v.filter((ver) => ver.type === 'release');
      setVersions(releases);
      if (releases.length > 0) {
        setSelectedVersion(releases[0].id);
        setSelectedUrl(releases[0].url);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (loaderType) {
      api.getLoaderVersions(loaderType).then(setLoaderVersions).catch(() => {});
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
        } catch (e: any) {
          setError(t('newInstance.loaderInstallFailed', { error: String(e) }));
          return;
        }
      }
      window.location.hash = '#/';
    } catch (e: any) {
      setError(e?.toString() || t('newInstance.createFailed'));
    } finally {
      setLoading(false);
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
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('newInstance.namePlaceholder')} />
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
                setActiveTemplate(
                  e.target.value === 'fabric' ? 'fabric' : 'forge'
                );
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

        <Button variant="primary" size="lg" disabled={loading || !name.trim()} onClick={handleCreate} data-tour="new-create">
          {loading ? t('newInstance.creating') : t('newInstance.create')}
        </Button>
      </div>
    </div>
  );
}
