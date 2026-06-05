import React from 'react';
import styles from './CrashAnalysisPanel.module.css';

interface CrashAnalysisPanelProps {
  instanceId: string;
  crashReportPath: string;
  severity: string;
  onFix: (instanceId: string, crashReportPath: string) => void;
  onDismiss: () => void;
}

const SEVERITY_CLASS_MAP: Record<string, string> = {
  critical: styles['severity--critical'],
  warning: styles['severity--warning'],
  info: styles['severity--info'],
};

export const CrashAnalysisPanel: React.FC<CrashAnalysisPanelProps> = ({
  instanceId,
  crashReportPath,
  severity,
  onFix,
  onDismiss,
}) => {
  const severityClass = SEVERITY_CLASS_MAP[severity] || styles['severity--info'];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Crash Detected</span>
        <button className={styles.closeBtn} onClick={onDismiss}>✕</button>
      </div>
      <span className={`${styles.severity} ${severityClass}`}>{severity}</span>
      <div className={styles.summary}>
        Instance <strong>{instanceId}</strong> crashed. Report: {crashReportPath.split('/').pop()}
      </div>
      <button className={styles.fixBtn} onClick={() => onFix(instanceId, crashReportPath)}>
        One-Click Fix
      </button>
      <button className={styles.dismissBtn} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
};
