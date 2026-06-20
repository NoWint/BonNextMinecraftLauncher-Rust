import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/stores/authStore';
import { useInstances } from '../../shared/stores/instanceStore';
import { useI18n } from '../../shared/i18n';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { useShortcutBindings } from '../../shared/hooks/useKeyboardShortcuts';
import { logger } from '../../shared/utils/logger';
import { Sidebar } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { SearchPalette } from './components/ui/SearchPalette';
import { DownloadPanel } from './components/ui/DownloadPanel';
import { UpdateNotification } from './components/ui';
import { ChatPanel } from './components/ai/ChatPanel';
import FriendsPanel from './components/social/FriendsPanel';
import { AppRoutes } from '../../app/components/AppRoutes';
import { usePluginSidebarItems } from '../../app/hooks/usePluginSidebarItems';
import LoginPage from './pages/LoginPage';

const PAGE_ID_TO_PATH: Record<string, string> = {
  home: '/home',
  marketplace: '/store',
  collections: '/collections',
  instances: '/instances',
  new_instance: '/instances/new',
  instance_detail: '/instances',
  content_detail: '/store',
  library: '/library',
  versions: '/versions',
  servers: '/servers',
  settings: '/settings',
  mods: '/store',
  store: '/store',
};

function ZZZAppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { t } = useI18n();
  const { state, togglePanel: toggleAIPanel } = useAIAssistant();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const pluginSidebarItems = usePluginSidebarItems();

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

  if (!authState.currentUser) {
    return (
      <ErrorBoundary>
        <div className="noise-overlay" />
        <div className="scanline-overlay" />
        <LoginPage />
      </ErrorBoundary>
    );
  }

  const totalPlaytimeHours = instState.instances.reduce((sum, inst) => sum + (inst.playtime_seconds || 0), 0) / 3600;

  return (
    <>
      <div className="noise-overlay" />
      <div className="scanline-overlay" />
      <div className="app-layout">
        <Sidebar
          navItems={navItems}
          username={authState.currentUser.username}
          accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
          playtimeHours={totalPlaytimeHours}
          onAIToggle={toggleAIPanel}
          onSocialToggle={() => setSocialOpen(!socialOpen)}
          onSocialOpen={() => setSocialOpen(true)}
        />
        <main className={`app-main ${state.isOpen ? 'app-main--ai-open' : ''}`}>
          <div className="decorative-rect decorative-rect--top-right" />
          <div className="decorative-rect decorative-rect--bottom-left" />

          <ErrorBoundary>
            <AppRoutes isAuthenticated={!!authState.currentUser} />
          </ErrorBoundary>
        </main>
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        instances={instState.instances}
        versions={[]}
        navigate={navigateTo}
      />

      <ChatPanel />
      <FriendsPanel isOpen={socialOpen} onClose={() => setSocialOpen(false)} />
      <UpdateNotification />
      <CommandPalette />
      <DownloadPanel />
      <OnboardingWizard open={onboardingOpen} onClose={handleCloseOnboarding} />
    </>
  );
}

export default ZZZAppShell;
