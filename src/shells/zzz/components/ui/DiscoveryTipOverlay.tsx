import { useState, useEffect, useCallback } from 'react';
import type { DiscoveryTip } from '../../../../shared/hooks/useDiscoveryTips';
import styles from './DiscoveryTipOverlay.module.css';

interface Props {
  tip: DiscoveryTip;
  onDismiss: (id: string) => void;
}

export default function DiscoveryTipOverlay({ tip, onDismiss }: Props) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [pointerPosition, setPointerPosition] = useState<'top' | 'bottom'>('top');

  const updatePosition = useCallback(() => {
    const target = document.querySelector(tip.target);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const cardWidth = 280;
    const cardHeight = 140;
    const offset = 14;

    let top: number;
    let left = Math.max(8, rect.left + rect.width / 2 - cardWidth / 2);
    left = Math.min(left, window.innerWidth - cardWidth - 8);

    if (rect.top > cardHeight + offset + 8) {
      top = rect.top - cardHeight - offset;
      setPointerPosition('bottom');
    } else {
      top = rect.bottom + offset;
      setPointerPosition('top');
    }

    top = Math.max(8, Math.min(top, window.innerHeight - cardHeight - 8));
    setPosition({ top, left });
  }, [tip.target]);

  useEffect(() => {
    updatePosition();
    const timer = setInterval(updatePosition, 500);
    window.addEventListener('resize', updatePosition);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  const handleDismiss = () => {
    onDismiss(tip.id);
  };

  if (!position) return null;

  const target = document.querySelector(tip.target);
  const targetRect = target?.getBoundingClientRect();

  return (
    <>
      {targetRect && (
        <div
          className={styles.tipPulse}
          style={{
            top: targetRect.top + targetRect.height / 2 - 6,
            left: targetRect.left + targetRect.width / 2 - 6,
          }}
        />
      )}
      <div className={styles.tipOverlay} style={{ top: position.top, left: position.left }}>
        <div className={styles.tipCard}>
          <div
            className={`${styles.tipPointer} ${
              pointerPosition === 'top' ? styles.tipPointerTop : styles.tipPointerBottom
            }`}
          />
          <div className={styles.tipHeader}>
            <div className={styles.tipTitle}>{tip.title}</div>
            <button className={styles.tipCloseBtn} onClick={handleDismiss} aria-label="Dismiss">
              ✕
            </button>
          </div>
          <div className={styles.tipDescription}>{tip.description}</div>
          <div className={styles.tipFooter}>
            <button className={styles.tipGotItBtn} onClick={handleDismiss}>
              GOT IT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
