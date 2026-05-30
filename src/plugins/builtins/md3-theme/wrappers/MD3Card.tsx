import { useRef, useEffect } from 'react';
import type { MD3CardProps } from '@/plugins/extensions';

const VARIANT_MAP = {
  elevated: 'md-elevated-card',
  filled: 'md-filled-card',
  outlined: 'md-outlined-card',
} as const;

export function MD3Card({ variant = 'elevated', children, onClick, className }: MD3CardProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  const Tag = VARIANT_MAP[variant];

  return (
    <Tag ref={ref as React.Ref<HTMLElement>} class={className || undefined}>
      {children}
    </Tag>
  );
}
