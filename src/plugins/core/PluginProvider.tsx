// src/plugins/core/PluginProvider.tsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { PluginManager } from './PluginManager';
import { pluginLoader } from './PluginLoader';
import type {
  DownloadProgressEvent,
  ContentDownloadProgress,
  WorkflowCompleteEvent,
} from '../../shared/api/types';

interface PluginProviderContext {
  manager: PluginManager;
  ready: boolean;
}

const Context = createContext<PluginProviderContext | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => new PluginManager());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 通过 PluginLoader 加载并激活所有插件（内置 + 已安装）
      await pluginLoader.loadAndActivateAll(manager);
      if (!cancelled) {
        setReady(true);
      }
    }

    init();

    return () => {
      cancelled = true;
      manager.deactivateAll();
    };
  }, [manager]);

  // 桥接核心 Tauri 事件到插件 EventBus。
  // 后端（启动器、下载器、工作流、崩溃监视器）发出的 Tauri 事件，
  // 以及前端 store 发出的 Tauri 事件，都在此转发给已激活插件的监听器。
  useEffect(() => {
    if (!ready) return;

    const unlisteners: Array<() => void> = [];

    // 启动状态变更 → instance:launched / instance:exited / instance:crashed
    listen<{ state: string; instance_id: string }>('launch-state-changed', (event) => {
      const { state, instance_id } = event.payload;
      const data = { instanceId: instance_id, state };
      if (state === 'running') {
        manager.emitEvent('instance:launched', data);
      } else if (state === 'exited') {
        manager.emitEvent('instance:exited', data);
      } else if (state === 'crashed') {
        manager.emitEvent('instance:crashed', data);
      }
    }).then((u) => unlisteners.push(u));

    // 版本下载完成 → download:completed
    listen<DownloadProgressEvent>('download-progress', (event) => {
      if (event.payload.finished) {
        manager.emitEvent('download:completed', {
          url: event.payload.current_url,
          filename: event.payload.current_url?.split('/').pop() ?? null,
        });
      }
    }).then((u) => unlisteners.push(u));

    // 内容（mod/资源包）下载完成 → download:completed
    listen<ContentDownloadProgress>('content-download-progress', (event) => {
      if (event.payload.finished) {
        manager.emitEvent('download:completed', {
          filename: event.payload.filename,
          slug: event.payload.slug,
        });
      }
    }).then((u) => unlisteners.push(u));

    // 工作流完成 → workflow:completed
    listen<WorkflowCompleteEvent>('workflow:complete', (event) => {
      manager.emitEvent('workflow:completed', event.payload);
    }).then((u) => unlisteners.push(u));

    // 崩溃监视器检测到崩溃报告 → instance:crashed
    listen<{ instance_id: string; path: string; kind?: string }>('crash:detected', (event) => {
      manager.emitEvent('instance:crashed', {
        instanceId: event.payload.instance_id,
        crashReportPath: event.payload.path,
      });
    }).then((u) => unlisteners.push(u));

    // 前端 store 转发：实例创建
    listen<{ instanceId: string; name: string }>('instance:created', (event) => {
      manager.emitEvent('instance:created', event.payload);
    }).then((u) => unlisteners.push(u));

    // 前端 store 转发：登录成功
    listen<{ username: string; uuid: string; method?: string }>('auth:login', (event) => {
      manager.emitEvent('auth:login', event.payload);
    }).then((u) => unlisteners.push(u));

    // 前端转发：安全威胁检测
    listen<unknown>('security:threat-detected', (event) => {
      manager.emitEvent('security:threat-detected', event.payload);
    }).then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((fn) => fn());
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
