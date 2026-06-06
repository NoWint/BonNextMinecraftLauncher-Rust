import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../shared/stores/authStore';
import { useInstances } from '../../shared/stores/instanceStore';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { useDownloads } from '../../shared/stores/downloadStore';
import { useSocial } from '../../shared/stores/socialStore';
import { useShortcutBindings } from '../../shared/hooks/useKeyboardShortcuts';
import { useLiquidGlass } from './hooks/useLiquidGlass';
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

const PATH_TO_LABEL: Record<string, string> = {
  '/home': 'Home',
  '/store': 'Marketplace',
  '/instances': 'Instances',
  '/instances/new': 'New Instance',
  '/versions': 'Versions',
  '/collections': 'Collections',
  '/library': 'Library',
  '/servers': 'Servers',
  '/settings': 'Settings',
};

function SwiftUIAppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { state: aiState, togglePanel: toggleAIPanel, sendMessage } = useAIAssistant();
  const { state: dlState } = useDownloads();
  const { friends } = useSocial();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const { isNativeLiquid, applyNativeGlass } = useLiquidGlass();

  // Apply native Liquid Glass on macOS 26+ (other platforms use CSS blur)
  useEffect(() => {
    if (isNativeLiquid) {
      applyNativeGlass();
      // Make backgrounds transparent for native vibrancy
      document.documentElement.style.background = 'Transparent';
      document.body.style.background = 'Transparent';
      const appRoot = document.getElementById('root');
      if (appRoot) appRoot.style.background = 'Transparent';
      const shell = document.querySelector('.swiftui-shell');
      shell?.classList.add('glass-native-liquid');
    }
    return () => {
      if (isNativeLiquid) {
        document.documentElement.style.background = '';
        document.body.style.background = '';
        const appRoot = document.getElementById('root');
        if (appRoot) appRoot.style.background = '';
      }
    };
  }, [isNativeLiquid, applyNativeGlass]);

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

  // Derive current page label from route
  const currentPath = location.pathname;
  const pageLabel = PATH_TO_LABEL[currentPath]
    || (currentPath.startsWith('/instances/') && currentPath !== '/instances/new' ? 'Instance' : null)
    || (currentPath.startsWith('/store/') ? 'Content' : null)
    || 'Home';

  // Build breadcrumb segments
  const breadcrumbSegments = currentPath
    .split('/')
    .filter(Boolean)
    .map((segment, i, arr) => {
      const path = '/' + arr.slice(0, i + 1).join('/');
      const label = PATH_TO_LABEL[path] || segment;
      return { path, label };
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
      {/* Column 1: Thick Glass Sidebar */}
      <Sidebar
        username={authState.currentUser.username}
        accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
      />

      {/* Column 2+3 wrapper */}
      <div className="swiftui-main-area">
        {/* Integrated toolbar row */}
        <div className="swiftui-toolbar">
          {/* Left: Nav buttons */}
          <div className="swiftui-toolbar-nav">
            <button
              className="swiftui-toolbar-btn"
              onClick={() => navigate(-1)}
              title="Go back"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="swiftui-toolbar-btn"
              onClick={() => navigate(1)}
              title="Go forward"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Center: Page name badge */}
          <div className="swiftui-toolbar-badge">
            {pageLabel}
          </div>

          {/* Right: Action icon group */}
          <div className="swiftui-toolbar-actions">
            <button
              className="swiftui-toolbar-btn"
              onClick={() => setSearchOpen(true)}
              title="Search"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="swiftui-toolbar-btn"
              onClick={() => setShowPanel((v) => !v)}
              title="Toggle panel"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 2V14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              className="swiftui-toolbar-btn"
              onClick={() => navigate('/settings')}
              title="Settings"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.05 3.05L4.1 4.1M11.9 11.9L12.95 12.95M12.95 3.05L11.9 4.1M4.1 11.9L3.05 12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Breadcrumb bar */}
        <div className="swiftui-breadcrumb">
          {breadcrumbSegments.map((seg, i) => (
            <span key={seg.path} className="swiftui-breadcrumb-segment">
              {i > 0 && <span className="swiftui-breadcrumb-sep">/</span>}
              <button
                className="swiftui-breadcrumb-link"
                onClick={() => navigate(seg.path)}
              >
                {seg.label}
              </button>
            </span>
          ))}
        </div>

        {/* Page content */}
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
      </div>

      {/* Column 3: Right Panel (conditional) */}
      {showPanel && (
        <aside className="swiftui-panel">
          <div className="swiftui-panel-header">
            <span className="swiftui-panel-title">Panel</span>
            <button
              className="swiftui-toolbar-btn"
              onClick={() => setShowPanel(false)}
              title="Close panel"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="swiftui-panel-content">
            {/* Activity / Downloads / File tree — populated in later tasks */}
          </div>
        </aside>
      )}

      {/* Overlays */}
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={instState.instances.map((i) => ({ id: i.id, title: i.name, meta: i.version_id }))}
        onSelect={(id) => navigate(`/instances/${id}`)}
      />

      <ChatPanel
        open={aiState.isOpen}
        messages={aiState.messages.map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))}
        onClose={toggleAIPanel}
        onSend={sendMessage}
      />

      <FriendsPanel
        isOpen={socialOpen}
        onClose={() => setSocialOpen(false)}
        friends={friends.map((f) => ({ id: f.id, name: f.name, status: (f.current_game ? 'in-game' : f.status === 'online' ? 'online' : 'offline') as 'online' | 'offline' | 'in-game' }))}
      />
      <DownloadPanel
        open={dlOpen || dlState.tasks.length > 0}
        items={dlState.tasks.map((t) => ({
          id: t.id,
          name: t.filename || t.title,
          progress: t.progress ?? 0,
          speed: t.speed ? `${(t.speed / 1024 / 1024).toFixed(1)} MB/s` : undefined,
        }))}
        onClose={() => setDlOpen(false)}
      />
    </div>
  );
}

export default SwiftUIAppShell;
