import { useState, useEffect } from 'react';
import { api, type AuditEntry } from '../../../../shared/api';
import { Icon } from './Icon';
import { useI18n } from '../../../../shared/i18n';
import styles from './AuditLogViewer.module.css';

interface AuditLogViewerProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ['ALL', 'AUTH', 'CRYPTO', 'DOWNLOAD', 'CONFIG', 'FILE', 'LAUNCH', 'SANDBOX'];

export default function AuditLogViewer({ open, onClose }: AuditLogViewerProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [category, setCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .getAuditLog(category === 'ALL' ? undefined : category, 100)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, category]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t('auditLog.title')}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('auditLog.closeAriaLabel')}>
            <Icon name="cross" size={14} />
          </button>
        </div>
        <div className={styles.filter}>
          <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.logList}>
          {loading ? (
            <div className={styles.empty}>{t('common.loading')}</div>
          ) : entries.length === 0 ? (
            <div className={styles.empty}>{t('auditLog.empty')}</div>
          ) : (
            entries.map((entry, i) => (
              <div key={i} className={`${styles.logEntry} ${styles[`logEntry--${entry.level.toLowerCase()}`]}`}>
                <span className={styles.logTime}>{entry.timestamp.replace('T', ' ').slice(0, 19)}</span>
                <span className={styles.logLevel}>{entry.level}</span>
                <span className={styles.logCategory}>[{entry.category}]</span>
                <span className={styles.logMessage}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
        <div className={styles.footer}>
          <button className={styles.closeFooterBtn} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
