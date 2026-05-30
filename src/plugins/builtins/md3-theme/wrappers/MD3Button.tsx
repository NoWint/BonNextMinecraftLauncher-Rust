import { useRef, useEffect } from 'react';
import type { MD3ButtonProps } from '@/plugins/extensions';

const VARIANT_MAP = {
  filled: 'md-filled-button',
  outlined: 'md-outlined-button',
  text: 'md-text-button',
  elevated: 'md-elevated-button',
  'filled-tonal': 'md-filled-tonal-button',
} as const;

export function MD3Button({ variant = 'filled', children, onClick, disabled, icon, href, type }: MD3ButtonProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  const Tag = VARIANT_MAP[variant];

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      disabled={disabled || undefined}
      href={href || undefined}
      type={type || undefined}
    >
      {icon}
      {children}
    </Tag>
  );
}
