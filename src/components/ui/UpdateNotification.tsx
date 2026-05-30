import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { AppUpdateInfo } from '../../api';
import { Icon } from './Icon';
import styles from './UpdateNotification.module.css';

export function UpdateNotification() {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .checkForUpdates()
        .then(setUpdate)
        .catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!update || dismissed) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await api.installUpdate();
    } catch {
      setInstalling(false);
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <Icon name="download" size={16} />
        <span className={styles.text}>
          New version <strong>{update.version}</strong> available
        </span>
        {update.body && <span className={styles.body}>{update.body.slice(0, 100)}</span>}
      </div>
      <div className={styles.actions}>
        <button className={styles.installBtn} onClick={handleInstall} disabled={installing}>
          {installing ? 'Installing...' : 'Update Now'}
        </button>
        <button className={styles.dismissBtn} onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  );
}
