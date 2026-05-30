import { useRef, useEffect } from 'react';
import type { MD3SwitchProps } from '@/plugins/extensions';

type MdSwitchEl = HTMLElement & { selected: boolean };

export function MD3Switch({ selected = false, onChange, disabled, icons }: MD3SwitchProps) {
  const ref = useRef<MdSwitchEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.selected = selected;
  }, [selected]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      onChange((e.target as MdSwitchEl).selected);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return (
    <md-switch ref={ref as React.Ref<MdSwitchEl>} disabled={disabled || undefined} icons={icons ? true : undefined}>
      {icons?.on && <div slot="on-icon">{icons.on}</div>}
      {icons?.off && <div slot="off-icon">{icons.off}</div>}
    </md-switch>
  );
}
