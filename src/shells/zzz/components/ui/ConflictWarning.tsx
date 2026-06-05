import { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import styles from './ConflictWarning.module.css';

interface ConflictItem {
  mod_a: string;
  mod_b: string;
  reason: string;
  severity: string;
}

interface ConflictWarningProps {
  instanceId: string;
}

const severityLabel: Record<string, string> = {
  high: '严重',
  medium: '中等',
};

export function ConflictWarning({ instanceId }: ConflictWarningProps) {
  const [conflicts, setConflicts] = useState<ConflictItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConflicts(null);
    api.checkModConflicts(instanceId)
      .then((data) => { if (!cancelled) setConflicts(data); })
      .catch(() => { if (!cancelled) setConflicts([]); });
    return () => { cancelled = true; };
  }, [instanceId]);

  if (conflicts === null) {
    return <div className={styles.skeleton} />;
  }

  if (conflicts.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>&#10003;</span>
        <span className={styles.emptyText}>No conflicts detected</span>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.panelWarning}`}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>&#9888;</span>
        <span className={styles.headerTitle}>模组冲突检测</span>
        <span className={styles.headerCount}>{conflicts.length} conflicts</span>
      </div>

      <div className={styles.conflicts}>
        {conflicts.map((c, i) => (
          <div key={i} className={styles.conflict}>
            <div className={styles.conflictMods}>
              <span className={styles.conflictModName}>{c.mod_a}</span>
              <span className={styles.conflictVs}>vs</span>
              <span className={styles.conflictModName}>{c.mod_b}</span>
            </div>
            <div className={styles.conflictReason}>{c.reason}</div>
            <span className={`${styles.severityBadge} ${c.severity === 'high' ? styles.severityHigh : styles.severityMedium}`}>
              {severityLabel[c.severity] || c.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
