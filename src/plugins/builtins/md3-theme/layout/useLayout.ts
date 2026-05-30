import { useState, useEffect } from 'react';
import { usePluginManager, usePluginReady } from '@/plugins/core';
import type { LayoutContribution } from '@/plugins/extensions';

export function useLayout(): LayoutContribution | null {
  const manager = usePluginManager();
  const ready = usePluginReady();
  const [layout, setLayout] = useState<LayoutContribution | null>(null);

  useEffect(() => {
    if (!ready) return;

    const point = manager.getExtensionPoint('bonnext:layout');
    if (!point || typeof (point as unknown as Record<string, unknown>).getActiveLayout !== 'function') {
      setLayout(null);
      return;
    }

    const layoutPoint = point as unknown as {
      getActiveLayout(): LayoutContribution | undefined;
      addListener(fn: (e: Event) => void): () => void;
    };
    const active = layoutPoint.getActiveLayout();
    setLayout(active ?? null);

    const unsub = layoutPoint.addListener(() => {
      const updated = layoutPoint.getActiveLayout();
      setLayout(updated ?? null);
    });

    return unsub;
  }, [ready, manager]);

  return layout;
}
