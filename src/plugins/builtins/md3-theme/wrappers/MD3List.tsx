import { useRef, useEffect } from 'react';
import type { MD3ListProps } from '@/plugins/extensions';

export function MD3List({ items }: MD3ListProps) {
  return (
    <md-list>
      {items.map((item, idx) => (
        <MD3ListItem key={idx} {...item} />
      ))}
    </md-list>
  );
}

function MD3ListItem({ headline, supportingText, leadingIcon, trailingIcon, onClick }: MD3ListProps['items'][0]) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  return (
    <md-list-item ref={ref as React.Ref<HTMLElement>} headline={headline} supporting-text={supportingText || undefined}>
      {leadingIcon && <div slot="start">{leadingIcon}</div>}
      {trailingIcon && <div slot="end">{trailingIcon}</div>}
    </md-list-item>
  );
}
