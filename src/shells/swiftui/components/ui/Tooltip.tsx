import { useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps { content: string; children: ReactNode; }

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.tooltip} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && <div className={styles.content}>{content}</div>}
    </div>
  );
}
