import { CloseIcon } from '../icons';
import { ProgressBar } from '../ui';
import { useGlassEffect } from '../../hooks/useGlassEffect';
import styles from './DownloadPanel.module.css';

interface DownloadItem { id: string; name: string; progress: number; speed?: string; }
interface DownloadPanelProps { open: boolean; items: DownloadItem[]; onClose: () => void; }

export function DownloadPanel({ open, items, onClose }: DownloadPanelProps) {
  const panelRef = useGlassEffect<HTMLDivElement>('strong');
  if (!open) return null;
  return (
    <div ref={panelRef} className={`${styles.panel} glass-thick`} role="region" aria-label="Downloads">
      <div className={styles.header}>
        <h3 className={styles.title}>Downloads ({items.length})</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--swift-text-tertiary)' }}><CloseIcon size={14} /></button>
      </div>
      <div className={styles.items}>
        {items.map((item) => (
          <div key={item.id} className={styles.item}>
            <span className={styles.itemName}>{item.name}</span>
            {item.speed && <span className={styles.itemSpeed}>{item.speed}</span>}
            <div className={styles.progressWrapper}><ProgressBar value={item.progress} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
