import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api';
import type { GameInstance, VersionEntry } from '../../../shared/api';
import { useToast } from '../../../shared/stores/toastStore';
import { Button, FormField, Select } from '../components/ui';
import styles from './NewInstancePage.module.css';

export default function NewInstancePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('none');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.getVersions().then((data) => {
      setVersions(data || []);
    }).catch((e) => {
      addToast({ type: 'error', title: 'Failed to load versions', message: e instanceof Error ? e.message : String(e) });
    });
  }, [addToast]);

  useEffect(() => {
    if (loader === 'none') {
      setLoaderVersions([]);
      setLoaderVersion('');
      return;
    }
    api.getLoaderVersions(loader).then((data) => {
      setLoaderVersions(data || []);
      setLoaderVersion(data?.[0] || '');
    }).catch((e) => {
      addToast({ type: 'error', title: 'Failed to load loader versions', message: e instanceof Error ? e.message : String(e) });
      setLoaderVersions([]);
      setLoaderVersion('');
    });
  }, [loader, addToast]);

  const selectedVersionEntry = versions.find((v) => v.id === version);

  const handleCreate = async () => {
    if (!name || !version) return;
    setCreating(true);
    try {
      const instance: GameInstance = {
        id: '',
        name,
        version_id: version,
        version_url: selectedVersionEntry?.url || '',
        loader_type: loader === 'none' ? null : loader,
        loader_version: loader === 'none' ? null : loaderVersion || null,
        description: '',
        max_memory: 2048,
        min_memory: 512,
        java_path: null,
        jvm_args: null,
        created_at: new Date().toISOString(),
        last_played: null,
        playtime_seconds: 0,
      };
      await api.createInstance(instance);
      navigate('/instances');
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to create instance', message: e instanceof Error ? e.message : String(e) });
    }
    setCreating(false);
  };

  const releaseVersions = versions.filter((v) => v.type === 'release');
  const versionOptions = releaseVersions.map((v) => ({ value: v.id, label: v.id }));

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">New Instance</h1>
      <p className="swiftui-page-subtitle">Create a new game instance</p>
      <div className={styles.form}>
        <div className={styles.fieldGroup}>
          <FormField
            label="Instance Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Instance"
          />
          <Select
            options={[{ value: '', label: 'Select version...' }, ...versionOptions]}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <Select
            options={[
              { value: 'none', label: 'None' },
              { value: 'fabric', label: 'Fabric' },
              { value: 'forge', label: 'Forge' },
            ]}
            value={loader}
            onChange={(e) => setLoader(e.target.value)}
          />
          {loader !== 'none' && loaderVersions.length > 0 && (
            <Select
              options={loaderVersions.map((lv) => ({ value: lv, label: lv }))}
              value={loaderVersion}
              onChange={(e) => setLoaderVersion(e.target.value)}
            />
          )}
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || !name || !version}
          >
            {creating ? 'Creating...' : 'Create Instance'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/instances')}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
