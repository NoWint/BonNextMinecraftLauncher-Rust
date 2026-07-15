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
const MarketplacePage = lazy(() => import('../../shells/zzz/pages/MarketplacePage'));
const LibraryPage = lazy(() => import('../../shells/zzz/pages/LibraryPage'));
const SettingsPage = lazy(() => import('../../shells/zzz/pages/SettingsPage'));
// ContentDetailPage：内容详情（mod/modpack/shader/resourcepack）。
// 之前仅 SwiftUI Shell 注册了 /store/:type/:slug，ZZZ Shell 漏配导致所有
// mod 卡片点击被 * 通配重定向回首页，975 行详情页代码完全闲置。
const ContentDetailPage = lazy(() => import('../../shells/zzz/pages/ContentDetailPage'));

function RouteLoading() {
  return <div className={styles.loading}>Loading...</div>;
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
        <Route path="/mods" element={<MarketplacePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 内容详情页（mod/modpack/shader/resourcepack）。
            /store/:type/:slug 是 ContentBrowser/LibraryPage/CollectionsPage 等处
            点击卡片的统一导航目标，必须显式注册，否则会被 * 通配重定向回首页。 */}
        <Route path="/store/:type/:slug" element={<ContentDetailPage />} />

        {/* 旧入口重定向到对应新页面 */}
        <Route path="/store" element={<Navigate to="/mods" replace />} />
        <Route path="/collections" element={<Navigate to="/mods" replace />} />

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
