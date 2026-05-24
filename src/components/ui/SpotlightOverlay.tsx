import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';
import styles from './SpotlightOverlay.module.css';

export interface TourStep {
  selector: string;
  page: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface Props {
  step: number;
  steps: TourStep[];
  onNext: (step: number) => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

function getElementRect(selector: string): Rect | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const visible = (
      r.width > 0 && r.height > 0 &&
      r.bottom > 0 && r.right > 0 &&
      r.top < window.innerHeight && r.left < window.innerWidth
    );
    if (!visible) return null;
    return { top: r.top, left: r.left, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  } catch {
    return null;
  }
}

function getTooltipPosition(
  rect: Rect,
  preferred: 'top' | 'bottom' | 'left' | 'right',
  tooltipW: number,
  tooltipH: number,
) {
  const gap = 12;
  let top: number;
  let left: number;

  const fits = {
    bottom: rect.bottom + gap + tooltipH <= window.innerHeight,
    top: rect.top - gap - tooltipH >= 0,
    right: rect.right + gap + tooltipW <= window.innerWidth,
    left: rect.left - gap - tooltipW >= 0,
  };

  let pos = preferred;
  if (pos === 'bottom' && !fits.bottom) {
    if (fits.top) pos = 'top';
    else if (fits.right) pos = 'right';
    else if (fits.left) pos = 'left';
  } else if (pos === 'top' && !fits.top) {
    if (fits.bottom) pos = 'bottom';
    else if (fits.right) pos = 'right';
    else if (fits.left) pos = 'left';
  } else if (pos === 'right' && !fits.right) {
    if (fits.left) pos = 'left';
    else if (fits.bottom) pos = 'bottom';
    else if (fits.top) pos = 'top';
  } else if (pos === 'left' && !fits.left) {
    if (fits.right) pos = 'right';
    else if (fits.bottom) pos = 'bottom';
    else if (fits.top) pos = 'top';
  }

  switch (pos) {
    case 'bottom':
      top = rect.bottom + gap;
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 16));
      break;
    case 'top':
      top = rect.top - gap - tooltipH;
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 16));
      break;
    case 'right':
      top = Math.max(16, rect.top + rect.height / 2 - tooltipH / 2);
      left = Math.min(rect.right + gap, window.innerWidth - tooltipW - 16);
      break;
    case 'left':
      top = Math.max(16, rect.top + rect.height / 2 - tooltipH / 2);
      left = Math.max(16, rect.left - gap - tooltipW);
      break;
    default:
      top = rect.bottom + gap;
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 16));
  }

  return { top, left, position: pos };
}

export function SpotlightOverlay({ step, steps, onNext, onSkip }: Props) {
  const { t } = useI18n();
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 100 });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number>(0);
  const currentStep = steps[step];

  const findAndSet = useCallback(() => {
    if (!currentStep) return;
    const r = getElementRect(currentStep.selector);
    if (r) {
      setRect(r);
      setVisible(true);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (tooltipRef.current) {
          const tw = tooltipRef.current.offsetWidth;
          const th = tooltipRef.current.offsetHeight;
          const tp = getTooltipPosition(r, currentStep.position, tw || 280, th || 120);
          setTooltipPos({ top: tp.top, left: tp.left });
        }
      });
    } else {
      setVisible(false);
    }
  }, [currentStep]);

  useEffect(() => {
    findAndSet();
    const timer = setTimeout(() => {
      findAndSet();
    }, 300);
    pollRef.current = setInterval(findAndSet, 500);
    return () => {
      clearTimeout(timer);
      if (pollRef.current) clearInterval(pollRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step, findAndSet]);

  useEffect(() => {
    if (!currentStep || !visible) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const match = target.closest(currentStep.selector);
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => onNext(step), 200);
      }
    };

    const captureHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-spotlight-tooltip]')) return;
      if (!target.closest(currentStep.selector)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener('click', captureHandler, true);
    document.addEventListener('mousedown', handler, false);

    return () => {
      document.removeEventListener('click', captureHandler, true);
      document.removeEventListener('mousedown', handler, false);
    };
  }, [currentStep, visible, step, onNext]);

  if (!currentStep) return null;

  const spotlightStyle = rect ? {
    boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.75)`,
    top: rect.top - 4,
    left: rect.left - 4,
    width: rect.width + 8,
    height: rect.height + 8,
    opacity: 1,
  } : { opacity: 0 };

  return createPortal(
    <div className={styles.container}>
      <div className={styles.overlayBg} />
      {rect && (
        <div className={styles.spotlight} style={spotlightStyle} />
      )}
      {visible && rect && (
        <div
          ref={tooltipRef}
          data-spotlight-tooltip
          className={styles.tooltip}
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          <div className={styles.tooltipStep}>
            {step + 1} / {steps.length}
          </div>
          <div className={styles.tooltipTitle}>{currentStep.title}</div>
          <div className={styles.tooltipDesc}>{currentStep.description}</div>
          <div className={styles.tooltipHint}>
            ⬆ {t('onboarding.spotlightHint') || 'Click the highlighted element'}
          </div>
        </div>
      )}
      <button className={styles.closeBtn} onClick={onSkip} aria-label="Skip tour">
        {t('onboarding.skip') || 'Skip'}
      </button>
    </div>,
    document.body,
  );
}
