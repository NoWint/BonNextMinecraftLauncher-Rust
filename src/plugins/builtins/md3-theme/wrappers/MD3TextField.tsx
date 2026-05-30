import { useRef, useEffect } from 'react';
import type { MD3TextFieldProps } from '@/plugins/extensions';

type MdTextFieldEl = HTMLElement & { value: string };

export function MD3TextField({
  variant = 'filled',
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  errorText,
  type,
  required,
  supportingText,
}: MD3TextFieldProps) {
  const ref = useRef<MdTextFieldEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      onChange((e.target as MdTextFieldEl).value);
    };
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [onChange]);

  const Tag = variant === 'filled' ? 'md-filled-text-field' : 'md-outlined-text-field';

  return (
    <Tag
      ref={ref as React.Ref<MdTextFieldEl>}
      label={label || undefined}
      value={value ?? ''}
      placeholder={placeholder || undefined}
      disabled={disabled || undefined}
      error={error || undefined}
      error-text={errorText || undefined}
      type={type || undefined}
      required={required || undefined}
      supporting-text={supportingText || undefined}
    />
  );
}
