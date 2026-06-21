import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Maximize2, X } from 'lucide-react';
import { useI18n } from '../../../../shared/i18n';
import styles from './TitleBar.module.css';

const isMacOS = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function TitleBar() {
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => {});
    const unlisten = win.onResized(() => {
      win
        .isMaximized()
        .then(setIsMaximized)
        .catch(() => {});
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <div
      className={`${styles.titlebar} ${isMacOS ? styles.osMacos : ''} ${isMaximized ? styles.maximized : ''}`}
      data-tauri-drag-region
    >
      {isMacOS && <div className={styles.trafficLightSpacer} data-tauri-drag-region />}

      <div className={styles.titleLeft} data-tauri-drag-region>
        {!isMacOS && <div className={styles.logoDiamond} data-tauri-drag-region />}
        <span className={styles.appName} data-tauri-drag-region>
          BONNEXT
        </span>
        <span className={styles.appVersion} data-tauri-drag-region>
          v0.0.5
        </span>
      </div>

      <div className={styles.titleCenter} data-tauri-drag-region />

      {!isMacOS && (
        <div className={styles.windowControls}>
          <button className={styles.controlBtn} onClick={handleMinimize} aria-label={t('titlebar.minimize')}>
            <Minus size={13} strokeWidth={1.5} />
          </button>
          <button
            className={styles.controlBtn}
            onClick={handleToggleMaximize}
            aria-label={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
          >
            {isMaximized ? <Maximize2 size={11} strokeWidth={1.5} /> : <Square size={11} strokeWidth={1.5} />}
          </button>
          <button className={`${styles.controlBtn} ${styles.btnClose}`} onClick={handleClose} aria-label={t('titlebar.close')}>
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
