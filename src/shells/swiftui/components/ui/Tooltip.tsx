import { useState, useId, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps { content: string; children: ReactNode; }

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  return (
    <div className={styles.tooltip} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} aria-describedby={visible ? tooltipId : undefined}>
      {children}
      {visible && <div className={`${styles.content} glass-ultrathin`} role="tooltip" id={tooltipId}>{content}</div>}
    </div>
  );
}
