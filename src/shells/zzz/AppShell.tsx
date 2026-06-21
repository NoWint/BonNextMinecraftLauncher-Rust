import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/stores/authStore';
import { useInstances } from '../../shared/stores/instanceStore';
import { useI18n } from '../../shared/i18n';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { useShortcutBindings } from '../../shared/hooks/useKeyboardShortcuts';
import { logger } from '../../shared/utils/logger';
import { useAllPlugins } from '../../app/hooks/useAllPlugins';
import { useTheme } from '../../shared/stores/themeStore';
import { Sidebar } from './components/layout';
import { PageBreadcrumb } from './components/layout/PageBreadcrumb';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DownloadPanel } from './components/ui/DownloadPanel';
import { UpdateNotification, OnboardingWizard, isOnboardingForceShow, isOnboardingCompleted, clearForceShow } from './components/ui';
import { AppRoutes } from '../../app/components/AppRoutes';
import { usePluginSidebarItems } from '../../app/hooks/usePluginSidebarItems';
import LoginPage from './pages/LoginPage';

// 覆盖层组件懒加载：这些组件仅在用户交互时显示，无需进入首屏 bundle。
const CommandPalette = lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const SearchPalette = lazy(() => import('./components/ui/SearchPalette').then(m => ({ default: m.SearchPalette })));
const ChatPanel = lazy(() => import('./components/ai/ChatPanel').then(m => ({ default: m.ChatPanel })));
const FriendsPanel = lazy(() => import('./components/social/FriendsPanel'));

const PAGE_ID_TO_PATH: Record<string, string> = {
  home: '/home',
  marketplace: '/versions',
  collections: '/collections',
  instances: '/instances',
  new_instance: '/instances/new',
  instance_detail: '/instances',
  content_detail: '/store',
  library: '/library',
  versions: '/versions',
  servers: '/servers',
  settings: '/settings',
  mods: '/versions',
  store: '/versions',
};

function ZZZAppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { t } = useI18n();
  const { state, togglePanel: toggleAIPanel } = useAIAssistant();
  const navigate = useNavigate();
  const location = useLocation();
  const { homeMode, homeBackground } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const pluginSidebarItems = usePluginSidebarItems();
  const allPlugins = useAllPlugins();

  // 极简主页模式：仅在 /home 路由下生效。
  // 保留侧边栏，主区域使用模糊背景 + 玩家皮肤模型，模仿 HMCL 默认主页。
  const isMinimalistHome = homeMode === 'minimalist' && location.pathname === '/home';

  // 检测是否有非内置插件安装（用户主动安装的第三方插件）
  // 仅当存在第三方插件时才显示 AI 助手/社交/好友面板（避免空壳功能困扰用户）
  const hasThirdPartyPlugins = useMemo(() => {
    return allPlugins.some((p) => !p.definition.id.startsWith('com.bonnext.'));
  }, [allPlugins]);

  // 登录后检查是否需要显示新手引导
  useEffect(() => {
    if (authState.currentUser) {
      if (isOnboardingForceShow() || !isOnboardingCompleted()) {
        setOnboardingOpen(true);
        clearForceShow();
      }
    }
  }, [authState.currentUser]);

  const handleCloseOnboarding = () => {
    setOnboardingOpen(false);
  };

  const navigateTo = (id: string) => {
    navigate(PAGE_ID_TO_PATH[id] || `/${id}`);
  };

  // 核心导航项（不可插件化）
  const coreNavItems = useMemo(
    () => [
      { id: 'home', label: t('nav.home'), shortcut: 'H', path: '/home' },
      { id: 'instances', label: t('nav.instances'), shortcut: 'I', path: '/instances' },
      { id: 'versions', label: t('nav.versions'), shortcut: 'V', path: '/versions' },
      { id: 'settings', label: t('nav.settings'), shortcut: ',', path: '/settings' },
    ],
    [t],
  );

  // 合并核心导航项 + 插件侧边栏项
  const navItems = useMemo(() => {
    const pluginItems = pluginSidebarItems.map((item) => ({
      id: item.id,
      label: item.label,
      shortcut: '',
      path: item.route,
      order: item.order,
    }));
    // 按 order 排序插件项，核心项保持相对顺序
    const merged = [...coreNavItems];
    // 插入插件项到正确位置（在 settings 之前）
    const settingsIdx = merged.findIndex((i) => i.id === 'settings');
    const sortedPluginItems = [...pluginItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (settingsIdx >= 0) {
      merged.splice(settingsIdx, 0, ...sortedPluginItems);
    } else {
      merged.push(...sortedPluginItems);
    }
    return merged;
  }, [coreNavItems, pluginSidebarItems]);

  useShortcutBindings({
    navigate: navigateTo,
    launchInstance: async (instanceId: string) => {
      const inst = instState.instances.find((i) => i.id === instanceId);
      if (!inst || !authState.currentUser) return;
      try {
        await api.launchGame(
          inst.version_id,
          inst.version_url,
          authState.currentUser.username,
          authState.currentUser.uuid,
          authState.currentUser.access_token,
          inst.max_memory,
          inst.min_memory,
          inst.java_path || undefined,
          inst.jvm_args || undefined,
          inst.id,
        );
      } catch (e) {
        logger.error('Quick launch failed:', e);
      }
    },
    setSearchOpen,
    onRefresh: () => {
      navigate('/versions');
    },
    instances: instState.instances,
    enabled: !!authState.currentUser,
  });

  // totalPlaytimeHours 必须在 early return 之前调用，否则当 authState.currentUser
  // 从 null 变为非 null 时会触发 "Rendered more hooks than during the previous render"。
  const totalPlaytimeHours = useMemo(
    () => instState.instances.reduce((sum, inst) => sum + (inst.playtime_seconds || 0), 0) / 3600,
    [instState.instances],
  );

  if (!authState.currentUser) {
    return (
      <ErrorBoundary>
        <div className="noise-overlay" />
        <div className="scanline-overlay" />
        <LoginPage />
      </ErrorBoundary>
    );
  }

  return (
    <>
      <a href="#main-content" className="skip-link">{t('a11y.skipToContent')}</a>
      {!isMinimalistHome && (
        <>
          <div className="noise-overlay" />
          <div className="scanline-overlay" />
        </>
      )}
      {isMinimalistHome ? (
        // 极简主页模式：保留侧边栏，主区域使用模糊背景图
        <div
          className="app-layout app-layout--minimalist-home"
          style={homeBackground ? { backgroundImage: `url(${homeBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <Sidebar
            navItems={navItems}
            username={authState.currentUser.username}
            accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
            playtimeHours={totalPlaytimeHours}
            onAIToggle={hasThirdPartyPlugins ? toggleAIPanel : undefined}
            onSocialToggle={hasThirdPartyPlugins ? () => setSocialOpen(!socialOpen) : undefined}
            onSocialOpen={hasThirdPartyPlugins ? () => setSocialOpen(true) : undefined}
          />
          <main id="main-content" className="app-main app-main--minimalist-home">
            <ErrorBoundary>
              <AppRoutes isAuthenticated={!!authState.currentUser} />
            </ErrorBoundary>
          </main>
        </div>
      ) : (
        <div className="app-layout">
          <Sidebar
            navItems={navItems}
            username={authState.currentUser.username}
            accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
            playtimeHours={totalPlaytimeHours}
            onAIToggle={hasThirdPartyPlugins ? toggleAIPanel : undefined}
            onSocialToggle={hasThirdPartyPlugins ? () => setSocialOpen(!socialOpen) : undefined}
            onSocialOpen={hasThirdPartyPlugins ? () => setSocialOpen(true) : undefined}
          />
          <main id="main-content" className={`app-main ${state.isOpen ? 'app-main--ai-open' : ''}`}>
            <div className="decorative-rect decorative-rect--top-right" />
            <div className="decorative-rect decorative-rect--bottom-left" />
            <PageBreadcrumb />
            <ErrorBoundary>
              <AppRoutes isAuthenticated={!!authState.currentUser} />
            </ErrorBoundary>
          </main>
        </div>
      )}

      <Suspense fallback={null}>
        <SearchPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          instances={instState.instances}
          versions={[]}
          navigate={navigateTo}
        />
      </Suspense>

      {/* AI 助手与社交面板仅在安装了第三方插件时渲染（避免空壳功能） */}
      {hasThirdPartyPlugins && (
        <Suspense fallback={null}>
          <ChatPanel />
        </Suspense>
      )}
      {hasThirdPartyPlugins && (
        <Suspense fallback={null}>
          <FriendsPanel isOpen={socialOpen} onClose={() => setSocialOpen(false)} />
        </Suspense>
      )}
      <UpdateNotification />
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <DownloadPanel />
      <OnboardingWizard open={onboardingOpen} onClose={handleCloseOnboarding} />
    </>
  );
}

export default ZZZAppShell;
