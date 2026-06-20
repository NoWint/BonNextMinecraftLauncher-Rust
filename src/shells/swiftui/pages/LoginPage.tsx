import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useAuth } from '../../../shared/stores/authStore';
import { useToast } from '../../../shared/stores/toastStore';
import { Button, Modal, FormField } from '../components/ui';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { microsoftLogin, offlineLogin } = useAuth();
  const { addToast } = useToast();
  const [appVersion, setAppVersion] = useState('');
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [offlineUsername, setOfflineUsername] = useState('');

  useEffect(() => {
    getVersion().then((v) => setAppVersion(v)).catch(() => setAppVersion('unknown'));
  }, []);

  const handleMicrosoftLogin = async () => {
    try {
      await microsoftLogin();
    } catch (e) {
      addToast({ type: 'error', title: 'Login failed', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleOfflineLogin = async () => {
    if (!offlineUsername.trim()) return;
    try {
      await offlineLogin(offlineUsername.trim());
      setShowOfflineDialog(false);
      setOfflineUsername('');
    } catch (e) {
      addToast({ type: 'error', title: 'Offline login failed', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>B</div>
        <h1 className={styles.title}>BonNext</h1>
        <p className={styles.subtitle}>Minecraft Launcher</p>
        <div className={styles.buttons}>
          <Button variant="primary" size="large" onClick={handleMicrosoftLogin}>
            Sign in with Microsoft
          </Button>
          <Button variant="secondary" onClick={() => setShowOfflineDialog(true)}>
            Play Offline
          </Button>
        </div>
        <div className={styles.version}>BonNext {appVersion ? `v${appVersion}` : ''}</div>
      </div>
      <Modal open={showOfflineDialog} onClose={() => setShowOfflineDialog(false)} title="Play Offline"
        footer={<><Button variant="secondary" onClick={() => setShowOfflineDialog(false)}>Cancel</Button><Button variant="primary" onClick={handleOfflineLogin} disabled={!offlineUsername.trim()}>Login</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--swift-spacing-md)' }}>
          <p style={{ color: 'var(--swift-text-secondary)', margin: 0 }}>Enter a username for offline mode:</p>
          <FormField
            label="Username"
            value={offlineUsername}
            onChange={(e) => setOfflineUsername(e.target.value)}
            placeholder="Player"
          />
        </div>
      </Modal>
    </div>
  );
}
