// src/app/components/AppRoutes.tsx
// 统一路由组件：核心路由 + 插件路由
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { usePluginRoutes } from '../hooks/usePluginRoutes';
import { PluginErrorBoundary } from './PluginErrorBoundary';

// 核心页面（直接导入，非懒加载 — 这些是启动器基础功能）
import HomePage from '../../shells/zzz/pages/HomePage';
import InstancesPage from '../../shells/zzz/pages/InstancesPage';
import InstanceDetailPage from '../../shells/zzz/pages/InstanceDetailPage';
import NewInstancePage from '../../shells/zzz/pages/NewInstancePage';
import VersionsPage from '../../shells/zzz/pages/VersionsPage';
import SettingsPage from '../../shells/zzz/pages/SettingsPage';
import LoginPage from '../../shells/zzz/pages/LoginPage';

function RouteLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-muted, #888)', fontSize: '0.7em' }}>
      Loading...
    </div>
  );
}

interface AppRoutesProps {
  isAuthenticated: boolean;
}

/**
 * 统一路由组件。
 * 核心路由（home/instances/versions/settings）直接定义，
 * 插件路由（store/servers 等）通过 PluginManager 动态注入。
 */
export function AppRoutes({ isAuthenticated }: AppRoutesProps) {
  const pluginRoutes = usePluginRoutes();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* 核心路由 */}
        <Route path="/home" element={<HomePage />} />
        <Route path="/instances" element={<InstancesPage />} />
        <Route path="/instances/new" element={<NewInstancePage />} />
        <Route path="/instances/:id" element={<InstanceDetailPage />} />
        <Route path="/versions" element={<VersionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 插件路由（由 PluginManager 注入） */}
        {pluginRoutes.map((route) => {
          const LazyComponent = React.lazy(route.component);
          return (
            <Route
              key={`${route.pluginId}:${route.path}`}
              path={route.path}
              element={
                <PluginErrorBoundary pluginId={route.pluginId}>
                  <Suspense fallback={<RouteLoading />}>
                    <LazyComponent />
                  </Suspense>
                </PluginErrorBoundary>
              }
            />
          );
        })}

        {/* 默认重定向 */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
