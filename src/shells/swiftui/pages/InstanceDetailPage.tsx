import { useParams, useNavigate } from 'react-router-dom';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useAuth } from '../../../shared/stores/authStore';
import { api } from '../../../shared/api';
import { Button, Badge } from '../components/ui';
import { LaunchIcon, TrashIcon } from '../components/icons';
import styles from './InstanceDetailPage.module.css';

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: instState } = useInstances();
  const { state: authState } = useAuth();
  const instance = instState.instances.find((i) => i.id === id);

  const handleLaunch = async () => {
    if (!instance || !authState.currentUser) return;
    try { await api.launchGame(instance.version_id, instance.version_url, authState.currentUser.username, authState.currentUser.uuid, authState.currentUser.access_token, instance.max_memory, instance.min_memory, instance.java_path || undefined, instance.jvm_args || undefined, instance.id); } catch (e) { console.error('Launch failed:', e); }
  };

  const handleDelete = async () => {
    if (!instance || !confirm(`Delete "${instance.name}"?`)) return;
    try { await api.deleteInstance(instance.id); navigate('/instances'); } catch (e) { console.error('Delete failed:', e); }
  };

  if (!instance) return <div className="swift-animate-page-enter"><p style={{ color: 'var(--swift-text-tertiary)' }}>Instance not found</p></div>;

  return (
    <div className="swift-animate-page-enter">
      <div className={styles.header}>
        <div className={styles.info}>
          <h1 className={styles.title}>{instance.name}</h1>
          <div className={styles.version}>{instance.version_id}{instance.loader_type && ` · ${instance.loader_type}`}</div>
          <div style={{ display: 'flex', gap: 'var(--swift-spacing-sm)', marginTop: 'var(--swift-spacing-sm)' }}>
            <Badge variant="accent">{instance.loader_type || 'Vanilla'}</Badge>
            <Badge variant="default">{Math.round((instance.max_memory || 2048) / 1024 * 100) / 100} GB</Badge>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" size="large" onClick={handleLaunch}><LaunchIcon size={14} /> Launch</Button>
          <Button variant="secondary" iconOnly onClick={handleDelete}><TrashIcon size={16} /></Button>
        </div>
      </div>
    </div>
  );
}
