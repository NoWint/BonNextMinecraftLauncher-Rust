import { useState, useEffect, useRef } from 'react';

/**
 * Animated number counter — smoothly animates from 0 (or previous value)
 * to the target value when it changes. Uses requestAnimationFrame for
 * butter-smooth 60fps transitions.
 */
export function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (target === prevTarget.current) {
      setDisplay(target);
      return;
    }

    const startValue = display;
    const delta = target - startValue;
    const startTime = performance.now();

    cancelAnimationFrame(frameRef.current);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-expo: f(t) = 1 - 2^(-10t)
      const eased = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(startValue + delta * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    prevTarget.current = target;

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

/**
 * Format large numbers with K/M suffix, with optional animation.
 */
export function formatNumber(n: number, animated = false): string {
  if (animated) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Format bytes to human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format seconds into human-readable duration.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
