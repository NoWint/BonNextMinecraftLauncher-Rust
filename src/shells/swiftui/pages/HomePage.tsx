import { api } from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { useInstances } from '../../../shared/stores/instanceStore';
import { Button } from '../components/ui';
import { LaunchIcon } from '../components/icons';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const defaultInstance = instState.instances[0];
  const totalPlaytime =
    instState.instances.reduce((sum, i) => sum + (i.playtime_seconds || 0), 0) / 3600;
  const totalMods = instState.instances.reduce(
    (sum, i) => sum + ((i as any).mod_count || 0),
    0,
  );

  const handleLaunch = async () => {
    if (!defaultInstance || !authState.currentUser) return;
    try {
      await api.launchGame(
        defaultInstance.version_id,
        defaultInstance.version_url,
        authState.currentUser.username,
        authState.currentUser.uuid,
        authState.currentUser.access_token,
        defaultInstance.max_memory,
        defaultInstance.min_memory,
        defaultInstance.java_path || undefined,
        defaultInstance.jvm_args || undefined,
        defaultInstance.id,
      );
    } catch (e) {
      console.error('Launch failed:', e);
    }
  };

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Home</h1>
      <p className="swiftui-page-subtitle">Welcome back, {authState.currentUser?.username}</p>
      {defaultInstance && (
        <div className={styles.quickLaunch}>
          <div>
            <div className={styles.launchLabel}>Quick Launch</div>
            <div className={styles.launchTitle}>{defaultInstance.name}</div>
            <div className={styles.launchMeta}>
              {defaultInstance.version_id}
              {defaultInstance.loader_type && ` · ${defaultInstance.loader_type}`} ·{' '}
              {Math.round((defaultInstance.max_memory || 2048) / 1024 * 100) / 100} GB allocated
            </div>
          </div>
          <Button variant="primary" size="large" onClick={handleLaunch}>
            <LaunchIcon size={14} /> Launch
          </Button>
        </div>
      )}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Instances</div>
          <div className={styles.statValue}>{instState.instances.length}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Playtime</div>
          <div className={styles.statValue}>{Math.round(totalPlaytime)}h</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Mods Installed</div>
          <div className={styles.statValue}>{totalMods}</div>
        </div>
      </div>
    </div>
  );
}
