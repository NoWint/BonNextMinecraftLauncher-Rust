// src/app/hooks/useExtensions.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';
import type { Contribution } from '../../plugins/core/ExtensionPoint';

/**
 * 响应式获取某扩展点的所有贡献。
 * 基于 useSyncExternalStore，当贡献列表变更时自动重渲染。
 *
 * @param epId 扩展点 ID
 * @returns 贡献列表，按 order 升序排列
 */
export function useExtensions<T = unknown>(epId: string): Contribution<T>[] {
  const manager = usePluginManager();
  const registry = manager.getExtensionPointRegistry();
  return useSyncExternalStore(
    (cb) => registry.subscribe(cb),
    () => registry.getContributions<T>(epId),
  );
}
