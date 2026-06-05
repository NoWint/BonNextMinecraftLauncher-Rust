import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api';
import type { GameInstance } from '../../../shared/api';
import { Button, FormField, Select } from '../components/ui';
import styles from './NewInstancePage.module.css';

export default function NewInstancePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('none');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name || !version) return;
    setCreating(true);
    try {
      const instance: GameInstance = {
        id: '',
        name,
        version_id: version,
        version_url: '',
        loader_type: loader === 'none' ? null : loader,
        loader_version: null,
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
      console.error('Failed to create instance:', e);
    }
    setCreating(false);
  };

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
          <FormField
            label="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.21.4"
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
