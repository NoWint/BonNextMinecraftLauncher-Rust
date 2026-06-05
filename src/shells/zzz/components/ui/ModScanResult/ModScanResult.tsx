import type { ScanResult } from '../../../../../shared/api/modScanner';
import styles from './ModScanResult.module.css';

interface ModScanResultProps {
  result: ScanResult;
  onClick?: () => void;
}

const sourceBadgeMap: Record<string, { label: string; className: string }> = {
  Modrinth: { label: 'MR', className: styles.badgeModrinth },
  CurseForge: { label: 'CF', className: styles.badgeCurseForge },
  Fallback: { label: '?', className: styles.badgeFallback },
};

export default function ModScanResult({ result, onClick }: ModScanResultProps) {
  const badge = sourceBadgeMap[result.source] || sourceBadgeMap.Fallback;
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.icon}>
        {result.icon_url ? (
          <img src={result.icon_url} alt="" />
        ) : (
          <div className={styles.iconPlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{result.project_name || result.file_name}</div>
        <div className={styles.fileName}>{result.file_name}</div>
      </div>
      <span className={`${styles.badge} ${badge.className}`}>{badge.label}</span>
    </div>
  );
}
