import { useRef, useEffect } from 'react';
import type { MD3SelectProps } from '@/plugins/extensions';

type MdSelectEl = HTMLElement & { value: string };

export function MD3Select({
  variant = 'filled',
  label,
  value,
  onChange,
  children,
  disabled,
  error,
  errorText,
}: MD3SelectProps) {
  const ref = useRef<MdSelectEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = () => {
      onChange(el.value);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  const Tag = variant === 'filled' ? 'md-filled-select' : 'md-outlined-select';

  return (
    <Tag
      ref={ref as React.Ref<MdSelectEl>}
      label={label || undefined}
      value={value || undefined}
      disabled={disabled || undefined}
      error={error || undefined}
      error-text={errorText || undefined}
    >
      {children}
    </Tag>
  );
}
