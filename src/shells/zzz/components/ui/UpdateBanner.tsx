import { useState } from 'react';
import { api, type AppUpdateInfo } from '../../../../shared/api';
import styles from './UpdateBanner.module.css';

const SKIP_VERSION_KEY = 'bonnext_skip_version';

function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIP_VERSION_KEY);
  } catch {
    return null;
  }
}

function setSkippedVersion(version: string) {
  try {
    localStorage.setItem(SKIP_VERSION_KEY, version);
  } catch {
    /* empty */
  }
}

interface Props {
  updateInfo: AppUpdateInfo;
  onDismiss: () => void;
}

export default function UpdateBanner({ updateInfo, onDismiss }: Props) {
  const [showChangelog, setShowChangelog] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleSkip = () => {
    setSkippedVersion(updateInfo.version);
    setDismissed(true);
    onDismiss();
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  const handleUpdate = async () => {
    if (updateInfo.download_url) {
      try {
        await api.openUrl(updateInfo.download_url);
      } catch {
        /* empty */
      }
    }
  };

  return (
    <div>
      <div className={styles.banner}>
        <span className={styles.bannerIcon}>⬆</span>
        <div className={styles.bannerContent}>
          <span className={styles.bannerVersion}>v{updateInfo.version}</span>
          <span className={styles.bannerText}>A new version of BonNext is available</span>
          {updateInfo.body && (
            <button className={styles.changelogToggle} onClick={() => setShowChangelog((v) => !v)}>
              {showChangelog ? '[-] HIDE' : '[+] CHANGELOG'}
            </button>
          )}
        </div>
        <div className={styles.bannerActions}>
          <button className={styles.updateBtn} onClick={handleUpdate}>
            UPDATE NOW
          </button>
          <button className={styles.skipBtn} onClick={handleSkip}>
            SKIP THIS VERSION
          </button>
          <button className={styles.dismissBtn} onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      </div>
      {showChangelog && updateInfo.body && (
        <div className={styles.changelogPanel}>
          <div className={styles.changelogBody}>{updateInfo.body}</div>
        </div>
      )}
    </div>
  );
}

export { getSkippedVersion, SKIP_VERSION_KEY };
