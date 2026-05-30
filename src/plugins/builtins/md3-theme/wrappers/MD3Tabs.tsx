import { useRef, useEffect } from 'react';
import type { MD3TabsProps } from '@/plugins/extensions';

type MdTabsEl = HTMLElement & { activeTabIndex: number };

export function MD3Tabs({ items, activeId, onChange, variant = 'primary' }: MD3TabsProps) {
  const ref = useRef<MdTabsEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.findIndex((i) => i.id === activeId);
    if (idx >= 0 && el.activeTabIndex !== idx) {
      el.activeTabIndex = idx;
    }
  }, [activeId, items]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onChange) return;
    const handler = (e: Event) => {
      const idx = (e.target as MdTabsEl).activeTabIndex;
      if (items[idx]) {
        onChange(items[idx].id);
      }
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange, items]);

  const Tag = variant === 'primary' ? 'md-primary-tab' : 'md-secondary-tab';

  return (
    <md-tabs ref={ref as React.Ref<MdTabsEl>}>
      {items.map((item) => (
        <Tag key={item.id}>
          {item.icon && <span slot="icon">{item.icon}</span>}
          {item.label}
        </Tag>
      ))}
    </md-tabs>
  );
}
