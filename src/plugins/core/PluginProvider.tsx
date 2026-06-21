// src/plugins/core/PluginProvider.tsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { PluginManager } from './PluginManager';
import { pluginLoader } from './PluginLoader';
import { registerBuiltinComponents } from '../builtins/_registry';
import type {
  DownloadProgressEvent,
  ContentDownloadProgress,
  WorkflowCompleteEvent,
} from '../../shared/api/types';

interface PluginProviderContext {
  manager: PluginManager;
  ready: boolean;
}

// HMR-safe Context：将 Context 存储在 globalThis 上，
// 模块热更新时复用同一 Context 实例，避免已挂载组件引用旧 Context 导致
// "usePluginManager must be used within PluginProvider" 错误。
const globalForPlugins = globalThis as unknown as {
  __PluginProviderContext?: React.Context<PluginProviderContext | null>;
};
const Context =
  globalForPlugins.__PluginProviderContext ??
  (globalForPlugins.__PluginProviderContext = createContext<PluginProviderContext | null>(null));

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => new PluginManager());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 启动性能优化：分两阶段加载插件。
      // 阶段 1（同步快路径）：注册并激活内置插件，立即 setReady(true)，
      //   让 AppRoutes 能尽快渲染核心路由。
      // 阶段 2（后台异步）：加载已安装的第三方插件并激活。
      //   失败不影响已 ready 状态。
      try {
        // 阶段 1：内置插件（同步注册 + 激活）
        registerBuiltinComponents();
        pluginLoader.loadBuiltinPlugins(manager);
        await manager.activateAll();
      } catch (e) {
        console.error('[PluginProvider] Failed to activate builtin plugins:', e);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }

      // 阶段 2：已安装的第三方插件（后台异步，不阻塞 UI）
      if (!cancelled) {
        try {
          await pluginLoader.loadInstalledPlugins(manager);
          await manager.activateAll();
        } catch (e) {
          console.error('[PluginProvider] Failed to load installed plugins:', e);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      // deactivateAll 是异步的，但 useEffect cleanup 不能是 async。
      // 采用 fire-and-forget 并捕获错误，避免 unhandled rejection。
      void manager.deactivateAll().catch((e) => {
        console.error('[PluginProvider] Error during deactivateAll:', e);
      });
    };
  }, [manager]);

  // 桥接核心 Tauri 事件到插件 EventBus。
  // 后端（启动器、下载器、工作流、崩溃监视器）发出的 Tauri 事件，
  // 以及前端 store 发出的 Tauri 事件，都在此转发给已激活插件的监听器。
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    // 竞态安全的监听器注册：若组件在 listen() resolve 前卸载，
    // unlisten 函数会被立即调用，而不是被推入 cleanup 已遍历过的数组，
    // 从而避免监听器泄漏。
    const bridge = <T,>(eventName: string, handler: (payload: T) => void) => {
      listen<T>(eventName, (event) => handler(event.payload))
        .then((u) => {
          if (cancelled) {
            u();
          } else {
            unlisteners.push(u);
          }
        })
        .catch((e) => {
          console.error(`[PluginProvider] Failed to listen to "${eventName}":`, e);
        });
    };

    // 启动状态变更 → instance:launched / instance:exited / instance:crashed
    bridge<{ state: string; instance_id: string }>('launch-state-changed', ({ state, instance_id }) => {
      const data = { instanceId: instance_id, state };
      if (state === 'running') {
        manager.emitEvent('instance:launched', data);
      } else if (state === 'exited') {
        manager.emitEvent('instance:exited', data);
      } else if (state === 'crashed') {
        manager.emitEvent('instance:crashed', data);
      }
    });

    // 版本下载完成 → download:completed
    bridge<DownloadProgressEvent>('download-progress', (payload) => {
      if (payload.finished) {
        manager.emitEvent('download:completed', {
          url: payload.current_url,
          filename: payload.current_url?.split('/').pop() ?? null,
        });
      }
    });

    // 内容（mod/资源包）下载完成 → download:completed
    bridge<ContentDownloadProgress>('content-download-progress', (payload) => {
      if (payload.finished) {
        manager.emitEvent('download:completed', {
          filename: payload.filename,
          slug: payload.slug,
        });
      }
    });

    // 工作流完成 → workflow:completed
    bridge<WorkflowCompleteEvent>('workflow:complete', (payload) => {
      manager.emitEvent('workflow:completed', payload);
    });

    // 崩溃监视器检测到崩溃报告 → instance:crashed
    bridge<{ instance_id: string; path: string; kind?: string }>('crash:detected', (payload) => {
      manager.emitEvent('instance:crashed', {
        instanceId: payload.instance_id,
        crashReportPath: payload.path,
      });
    });

    // 前端 store 转发：实例创建
    bridge<{ instanceId: string; name: string }>('instance:created', (payload) => {
      manager.emitEvent('instance:created', payload);
    });

    // 前端 store 转发：登录成功
    bridge<{ username: string; uuid: string; method?: string }>('auth:login', (payload) => {
      manager.emitEvent('auth:login', payload);
    });

    // 前端转发：安全威胁检测
    bridge<unknown>('security:threat-detected', (payload) => {
      manager.emitEvent('security:threat-detected', payload);
    });

    // 前端转发：mod 安装完成（由 shared/api 在 installMod/installContent/downloadCfMod 成功后发出）
    bridge<{
      instanceId: string;
      filename: string;
      slug?: string;
      versionId?: string;
      source?: string;
      contentType?: string;
      url?: string;
    }>('mod:installed', (payload) => {
      manager.emitEvent('mod:installed', payload);
    });

    return () => {
      cancelled = true;
      for (const u of unlisteners) {
        try {
          u();
        } catch (e) {
          console.error('[PluginProvider] Error during unlisten:', e);
        }
      }
    };
  }, [manager, ready]);

  const value = useMemo(() => ({ manager, ready }), [manager, ready]);

  return React.createElement(Context.Provider, { value }, children);
}

export function usePluginManager(): PluginManager {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error('usePluginManager must be used within PluginProvider');
  }
  return ctx.manager;
}

export function usePluginReady(): boolean {
  const ctx = useContext(Context);
  return ctx?.ready ?? false;
}
