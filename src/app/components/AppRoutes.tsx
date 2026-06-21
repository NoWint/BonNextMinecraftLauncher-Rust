// src/app/components/AppRoutes.tsx
// 统一路由组件：核心路由 + 插件路由
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { usePluginRoutes } from '../hooks/usePluginRoutes';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import styles from './AppRoutes.module.css';

// 核心页面：HomePage 直接导入（首屏必需），其余懒加载以减小主 bundle。
import HomePage from '../../shells/zzz/pages/HomePage';
import LoginPage from '../../shells/zzz/pages/LoginPage';

const InstancesPage = lazy(() => import('../../shells/zzz/pages/InstancesPage'));
const InstanceDetailPage = lazy(() => import('../../shells/zzz/pages/InstanceDetailPage'));
const NewInstancePage = lazy(() => import('../../shells/zzz/pages/NewInstancePage'));
const VersionsPage = lazy(() => import('../../shells/zzz/pages/VersionsPage'));
const SettingsPage = lazy(() => import('../../shells/zzz/pages/SettingsPage'));

function RouteLoading() {
  return (
    <div className={styles.loading}>
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
 *
 * 性能：核心路由不等待插件系统就绪即可渲染。插件路由自身有 Suspense，
 * 会等插件系统加载完成后按需渲染。
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

        {/* 商店、收藏、内容库已迁入下载中心，重定向到 /versions */}
        <Route path="/store" element={<Navigate to="/versions" replace />} />
        <Route path="/mods" element={<Navigate to="/versions" replace />} />
        <Route path="/collections" element={<Navigate to="/versions" replace />} />
        <Route path="/library" element={<Navigate to="/versions" replace />} />

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
