import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useAuth } from '../../../shared/stores/authStore';
import { useToast } from '../../../shared/stores/toastStore';
import { api } from '../../../shared/api';
import { Button, Badge, Modal } from '../components/ui';
import { LaunchIcon, TrashIcon } from '../components/icons';
import styles from './InstanceDetailPage.module.css';

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: instState } = useInstances();
  const { state: authState } = useAuth();
  const { addToast } = useToast();
  const instance = instState.instances.find((i) => i.id === id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLaunch = async () => {
    if (!instance || !authState.currentUser) return;
    try { await api.launchGame(instance.version_id, instance.version_url, authState.currentUser.username, authState.currentUser.uuid, authState.currentUser.access_token, instance.max_memory, instance.min_memory, instance.java_path || undefined, instance.jvm_args || undefined, instance.id); } catch (e) { addToast({ type: 'error', title: 'Launch failed', message: e instanceof Error ? e.message : String(e) }); }
  };

  const handleDelete = async () => {
    if (!instance) return;
    try { await api.deleteInstance(instance.id); setShowDeleteConfirm(false); navigate('/instances'); } catch (e) { setShowDeleteConfirm(false); addToast({ type: 'error', title: 'Delete failed', message: e instanceof Error ? e.message : String(e) }); }
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
          <Button variant="secondary" iconOnly onClick={() => setShowDeleteConfirm(true)}><TrashIcon size={16} /></Button>
        </div>
      </div>
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Instance"
        footer={<><Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button><Button variant="primary" onClick={handleDelete}>Delete</Button></>}>
        <p style={{ color: 'var(--swift-text-secondary)' }}>Are you sure you want to delete "{instance?.name}"? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
