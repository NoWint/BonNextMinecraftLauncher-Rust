import { useState, useEffect } from 'react';
import { api, type VersionEntry, type GameInstance } from '../api';
import { useInstances } from '../stores/instanceStore';
import { SectionHeader, SubLabel } from '../components/layout';
import { Button, TextInput, Select } from '../components/ui';
import styles from './NewInstancePage.module.css';

export default function NewInstancePage() {
  const { createInstance } = useInstances();
  const [name, setName] = useState('');
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loaderType, setLoaderType] = useState('');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    }
  }, [loaderType]);

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
          setError(`Loader install failed: ${e}. Instance created without loader.`);
        }
      }
      window.location.hash = '#/';
    } catch (e: any) {
      setError(e?.toString() || 'Failed to create instance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <SectionHeader title="NEW INSTANCE" />
      <div className={styles.form}>
        <div>
          <SubLabel>INSTANCE NAME</SubLabel>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="My Minecraft" />
        </div>
        <div>
          <SubLabel>VERSION</SubLabel>
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
        <div>
          <SubLabel>MOD LOADER (OPTIONAL)</SubLabel>
          <Select
            value={loaderType}
            onChange={(e) => setLoaderType(e.target.value)}
            options={[
              { value: '', label: 'None (Vanilla)' },
              { value: 'fabric', label: 'Fabric' },
              { value: 'forge', label: 'Forge' },
            ]}
          />
        </div>
        {loaderType && loaderVersions.length > 0 && (
          <div>
            <SubLabel>LOADER VERSION</SubLabel>
            <Select
              value={loaderVersion}
              onChange={(e) => setLoaderVersion(e.target.value)}
              options={loaderVersions.slice(0, 20).map((v) => ({ value: v, label: v }))}
            />
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <Button variant="primary" size="lg" disabled={loading || !name.trim()} onClick={handleCreate}>
          {loading ? 'CREATING...' : 'CREATE'}
        </Button>
      </div>
    </div>
  );
}
