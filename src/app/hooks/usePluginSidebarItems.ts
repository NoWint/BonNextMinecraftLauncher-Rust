// src/app/hooks/usePluginSidebarItems.ts
import { useSyncExternalStore, useMemo } from 'react';
import { usePluginManager } from './usePluginManager';
import { useI18n, resolvePluginLabel } from '../../shared/i18n';
import type { SidebarItem } from '../../plugins/core/types';

/** 解析后的侧边栏项（label 已转换为字符串） */
export type ResolvedSidebarItem = Omit<SidebarItem, 'label'> & { label: string };

export function usePluginSidebarItems(): ResolvedSidebarItem[] {
  const manager = usePluginManager();
  const { t } = useI18n();
  const items = useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getSidebarItems(),
  );
  // 通过 i18n 解析 label：字符串原样返回，{ i18nKey } 通过 t() 解析
  return useMemo(
    () =>
      items.map((item) => ({
        ...item,
        label: resolvePluginLabel(item.label, t),
      })),
    [items, t],
  );
}
