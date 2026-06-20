import { useNavigate } from 'react-router-dom';
import { useInstances } from '../../../shared/stores/instanceStore';
import { Button, Badge } from '../components/ui';
import { PlusIcon } from '../components/icons';
import styles from './InstancesPage.module.css';

export default function InstancesPage() {
  const { state } = useInstances();
  const navigate = useNavigate();

  return (
    <div className="swift-animate-page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="swiftui-page-title">Instances</h1>
          <p className="swiftui-page-subtitle">Manage your game instances</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/instances/new')}>
          <PlusIcon size={14} /> New Instance
        </Button>
      </div>
      <div className={styles.grid}>
        {state.instances.map((inst) => (
          <div
            key={inst.id}
            className={styles.instanceCard}
            onClick={() => navigate(`/instances/${inst.id}`)}
          >
            <h3 className={styles.instanceName}>{inst.name}</h3>
            <div className={styles.instanceVersion}>{inst.version_id}</div>
            <div className={styles.instanceMeta}>
              {inst.loader_type && <Badge variant="accent">{inst.loader_type}</Badge>}
              <span
                style={{
                  font: 'var(--swift-font-metadata)',
                  color: 'var(--swift-text-quaternary)',
                }}
              >
                {Math.round((inst.max_memory || 2048) / 1024 * 100) / 100} GB
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
