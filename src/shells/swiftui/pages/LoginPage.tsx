import { useAuth } from '../../../shared/stores/authStore';
import { Button } from '../components/ui';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { microsoftLogin, offlineLogin } = useAuth();

  const handleMicrosoftLogin = async () => {
    try {
      await microsoftLogin();
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const handleOfflineLogin = async () => {
    const username = prompt('Enter offline username:');
    if (!username) return;
    try {
      await offlineLogin(username);
    } catch (e) {
      console.error('Offline login failed:', e);
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
          <Button variant="secondary" onClick={handleOfflineLogin}>
            Play Offline
          </Button>
        </div>
        <div className={styles.version}>BonNext v1.0.0</div>
      </div>
    </div>
  );
}
