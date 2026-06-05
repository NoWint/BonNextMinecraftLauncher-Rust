import { useCallback, useRef } from 'react';

type SpringPreset = 'default' | 'gentle' | 'bouncy';

const SPRING_PRESETS: Record<SpringPreset, string> = {
  default: 'cubic-bezier(0.175, 0.885, 0.32, 1.1)',
  gentle: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const DURATION_PRESETS: Record<'fast' | 'normal' | 'slow', number> = {
  fast: 150,
  normal: 250,
  slow: 350,
};

interface SpringOptions {
  preset?: SpringPreset;
  duration?: 'fast' | 'normal' | 'slow';
  delay?: number;
  property?: string;
}

export function useSpringAnimation() {
  const elementRef = useRef<HTMLElement>(null);

  const animate = useCallback(
    (options: SpringOptions = {}) => {
      const element = elementRef.current;
      if (!element) return;

      const {
        preset = 'default',
        duration = 'normal',
        delay = 0,
        property = 'all',
      } = options;

      element.style.transition = `${property} ${DURATION_PRESETS[duration]}ms ${SPRING_PRESETS[preset]} ${delay}ms`;
    },
    []
  );

  const animateIn = useCallback(
    (options: Omit<SpringOptions, 'property'> = {}) => {
      const element = elementRef.current;
      if (!element) return;

      const { preset = 'default', duration = 'normal', delay = 0 } = options;
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
      element.style.transition = `all ${DURATION_PRESETS[duration]}ms ${SPRING_PRESETS[preset]} ${delay}ms`;
    },
    []
  );

  return { ref: elementRef, animate, animateIn };
}
