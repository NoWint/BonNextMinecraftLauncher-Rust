import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/stores/authStore';
import { useInstances } from '../../shared/stores/instanceStore';
import { useI18n } from '../../shared/i18n';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { useShortcutBindings } from '../../shared/hooks/useKeyboardShortcuts';
import { Sidebar } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SearchPalette } from './components/ui/SearchPalette';
import { ChatPanel } from './components/ai/ChatPanel';
import FriendsPanel from './components/social/FriendsPanel';
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

export default ZZZAppShell;
