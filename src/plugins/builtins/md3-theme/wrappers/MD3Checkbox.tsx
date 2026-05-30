import { useRef, useEffect } from 'react';
import type { MD3CheckboxProps } from '@/plugins/extensions';

type MdCheckboxEl = HTMLElement & { checked: boolean; indeterminate: boolean };

export function MD3Checkbox({ checked = false, onChange, disabled, indeterminate }: MD3CheckboxProps) {
  const ref = useRef<MdCheckboxEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.checked = checked;
    el.indeterminate = indeterminate || false;
  }, [checked, indeterminate]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      onChange((e.target as MdCheckboxEl).checked);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return <md-checkbox ref={ref as React.Ref<MdCheckboxEl>} disabled={disabled || undefined} />;
}
