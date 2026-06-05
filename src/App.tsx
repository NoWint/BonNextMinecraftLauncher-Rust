import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './api';
import { composeProviders } from './utils/composeProviders';
import { AuthProvider, useAuth } from './stores/authStore';
import { ConfigProvider } from './stores/configStore';
import { InstanceProvider, useInstances } from './stores/instanceStore';
import { ToastProvider } from './stores/toastStore';
import { DownloadProvider } from './stores/downloadStore';
import { ThemeProvider } from './stores/themeStore';
import { AIAssistantProvider, useAIAssistant } from './stores/aiAssistantStore';
import { I18nProvider, useI18n } from './i18n';
import { Sidebar } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { SocialProvider } from './stores/socialStore';
import { ChatProvider } from './stores/chatStore';
import { SearchPalette } from './components/ui/SearchPalette';
import { DownloadPanel } from './components/ui/DownloadPanel';
import { ChatPanel } from './components/ai/ChatPanel';
import FriendsPanel from './components/social/FriendsPanel';
import { ContextMenuProvider } from './components/ContextMenu';
import { UpdateNotification } from './components/ui';
import { useShortcutBindings } from './hooks/useKeyboardShortcuts';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import InstanceDetailPage from './pages/InstanceDetailPage';
import NewInstancePage from './pages/NewInstancePage';
import VersionsPage from './pages/VersionsPage';
import MarketplacePage from './pages/MarketplacePage';
import ContentDetailPage from './pages/ContentDetailPage';
import LibraryPage from './pages/LibraryPage';
import CollectionsPage from './pages/CollectionsPage';
import SettingsPage from './pages/SettingsPage';
import ServersPage from './pages/ServersPage';

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
  mods: '/mods',
  store: '/store',
};

function AppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { t } = useI18n();
  const { state, togglePanel: toggleAIPanel } = useAIAssistant();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  const navigateTo = (id: string) => {
    navigate(PAGE_ID_TO_PATH[id] || `/${id}`);
  };

  const NAV_ITEMS = [
    { id: 'home', label: t('nav.home'), shortcut: 'H', path: '/home' },
    { id: 'marketplace', label: t('nav.marketplace') || 'Marketplace', shortcut: 'S', path: '/store' },
    { id: 'collections', label: t('nav.collections'), shortcut: 'C', path: '/collections' },
    { id: 'instances', label: t('nav.instances'), shortcut: 'I', path: '/instances' },
    { id: 'library', label: t('nav.library'), shortcut: 'L', path: '/library' },
    { id: 'versions', label: t('nav.versions'), shortcut: 'V', path: '/versions' },
    { id: 'servers', label: t('nav.servers') || 'Servers', shortcut: 'R', path: '/servers' },
    { id: 'settings', label: t('nav.settings'), shortcut: ',', path: '/settings' },
  ];

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
        console.error('Quick launch failed:', e);
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
          navItems={NAV_ITEMS}
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
            <Routes>
              <Route path="/home" element={<HomePage />} />
              <Route path="/instances" element={<InstancesPage />} />
              <Route path="/instances/new" element={<NewInstancePage />} />
              <Route path="/instances/:id" element={<InstanceDetailPage />} />
              <Route path="/versions" element={<VersionsPage />} />
              <Route path="/store" element={<MarketplacePage />} />
              <Route path="/mods" element={<MarketplacePage />} />
              <Route path="/store/:type/:slug" element={<ContentDetailPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/servers" element={<ServersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
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
    </>
  );
}

const providers = [
  ThemeProvider,
  I18nProvider,
  AuthProvider,
  ConfigProvider,
  InstanceProvider,
  ToastProvider,
  DownloadProvider,
  SocialProvider,
  ChatProvider,
  ContextMenuProvider,
  AIAssistantProvider,
];

const AppProviders = composeProviders(providers);

export default function App() {
  return (
    <HashRouter>
      <AppProviders>
        <UpdateNotification />
        <CommandPalette />
        <AppShell />
        <DownloadPanel />
      </AppProviders>
    </HashRouter>
  );
}
