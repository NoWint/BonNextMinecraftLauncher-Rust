import { useState, useRef, useEffect, useId, isValidElement, cloneElement } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
}

export function Tooltip({
  content,
  shortcut,
  children,
  position = 'top',
  delay = 500,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const tooltipId = useId();

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, { 'aria-describedby': tooltipId })
    : children;

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {trigger}
      {visible && (
        <div id={tooltipId} role="tooltip" className={`${styles.tooltip} ${styles[`tooltip--${position}`]}`}>
          <span className={styles.content}>{content}</span>
          {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
        </div>
      )}
    </div>
  );
}
