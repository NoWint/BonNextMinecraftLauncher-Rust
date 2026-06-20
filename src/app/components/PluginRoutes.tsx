// src/app/components/PluginRoutes.tsx
// 渲染插件注册的路由
import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { usePluginRoutes } from '../hooks/usePluginRoutes';

function PluginRouteLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-muted, #888)', fontSize: '0.7em' }}>
      Loading...
    </div>
  );
}

/**
 * 渲染所有插件通过 ctx.registerRoute() 注册的路由。
 * 核心路由由 AppShell 直接定义，本组件只处理插件路由。
 */
export function PluginRoutes() {
  const pluginRoutes = usePluginRoutes();

  if (pluginRoutes.length === 0) {
    return null;
  }

  return (
    <Suspense fallback={<PluginRouteLoading />}>
      <Routes>
        {pluginRoutes.map((route) => {
          const LazyComponent = React.lazy(route.component);
          return (
            <Route
              key={`${route.pluginId}:${route.path}`}
              path={route.path}
              element={<LazyComponent />}
            />
          );
        })}
      </Routes>
    </Suspense>
  );
}
