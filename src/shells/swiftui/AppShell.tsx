import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/stores/authStore';
import { useInstances } from '../../shared/stores/instanceStore';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { useShortcutBindings } from '../../shared/hooks/useKeyboardShortcuts';
import { Sidebar } from './components/layout';
import { SearchPalette, DownloadPanel, ChatPanel, FriendsPanel } from './components/features';
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
import './styles/global.css';

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
};

function SwiftUIAppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { state: aiState, togglePanel: toggleAIPanel } = useAIAssistant();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  const navigateTo = (id: string) => {
    navigate(PAGE_ID_TO_PATH[id] || `/${id}`);
  };

  useShortcutBindings({
    navigate: navigateTo,
    launchInstance: async () => {},
    setSearchOpen,
    onRefresh: () => navigate('/versions'),
    instances: instState.instances,
    enabled: !!authState.currentUser,
  });

  if (!authState.currentUser) {
    return (
      <div className="swiftui-shell">
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="swiftui-shell">
      <Sidebar
        username={authState.currentUser.username}
        accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
      />
      <main className="swiftui-content">
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
      </main>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={instState.instances.map((i) => ({ id: i.id, title: i.name, meta: i.version_id }))}
        onSelect={(id) => navigate(`/instances/${id}`)}
      />

      <ChatPanel
        open={aiState.isOpen}
        messages={[]}
        onClose={toggleAIPanel}
        onSend={() => {}}
      />

      <FriendsPanel isOpen={socialOpen} onClose={() => setSocialOpen(false)} />
      <DownloadPanel open={false} items={[]} onClose={() => {}} />
    </div>
  );
}

export default SwiftUIAppShell;
