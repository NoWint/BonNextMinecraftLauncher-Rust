import { useRef, useEffect } from 'react';
import type { FABProps } from '@/plugins/extensions';
import { Icon } from '@/shells/zzz/components/ui/Icon';

export function MD3FAB({ icon, label, variant = 'surface', size = 'medium', onClick, extended }: FABProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  return (
    <md-fab
      ref={ref as React.Ref<HTMLElement>}
      variant={variant}
      size={size === 'small' ? 'small' : undefined}
      label={label || undefined}
      extended={extended || undefined}
    >
      {icon && (
        <span slot="icon">
          <Icon name={icon} size={18} />
        </span>
      )}
    </md-fab>
  );
}
