import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { api } from './api';
import { AuthProvider, useAuth } from './stores/authStore';
import { ConfigProvider } from './stores/configStore';
import { InstanceProvider, useInstances } from './stores/instanceStore';
import { ToastProvider } from './stores/toastStore';
import { DownloadProvider } from './stores/downloadStore';
import { ThemeProvider } from './stores/themeStore';
import { I18nProvider, useI18n } from './i18n';
import { Sidebar, PageTransition } from './components/layout';
import { MiniMode, exitMiniMode } from './components/MiniMode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { SearchPalette } from './components/ui/SearchPalette';
import { DownloadPanel } from './components/ui/DownloadPanel';
import { ContextMenuProvider } from './components/ContextMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import LoginPage from './pages/LoginPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const InstancesPage = lazy(() => import('./pages/InstancesPage'));
const InstanceDetailPage = lazy(() => import('./pages/InstanceDetailPage'));
const NewInstancePage = lazy(() => import('./pages/NewInstancePage'));
const VersionsPage = lazy(() => import('./pages/VersionsPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const ContentDetailPage = lazy(() => import('./pages/ContentDetailPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageSkeleton() {
  return (
    <div style={{ padding: '2em', display: 'flex', flexDirection: 'column', gap: '1em' }}>
      <div style={{ width: '40%', height: '1.5em', background: 'var(--color-panel-alt)', clipPath: 'var(--clip-small)' }} />
      <div style={{ width: '100%', height: '12em', background: 'var(--color-panel-alt)', clipPath: 'var(--clip-medium)' }} />
      <div style={{ width: '80%', height: '0.8em', background: 'var(--color-panel-alt)', clipPath: 'var(--clip-small)' }} />
    </div>
  );
}

const NAV_ID_TO_PATH: Record<string, string> = {
  home: '/home',
  new_instance: '/instances/new',
  marketplace: '/store',
  instances: '/instances',
  collections: '/collections',
  library: '/library',
  versions: '/versions',
  settings: '/settings',
  content_detail: '/store',
};

function AppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { t } = useI18n();
  const routerNavigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [todayPlaytimeHours, setTodayPlaytimeHours] = useState(0);
  const [isMiniMode, setIsMiniMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bonnext_mini_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const fetchPlaytime = () => {
      api
        .getPlaytimeStats()
        .then((stats) => {
          const todayKey = new Date().toISOString().slice(0, 10);
          const todaySeconds = stats.daily[todayKey] || 0;
          setTodayPlaytimeHours(todaySeconds / 3600);
        })
        .catch(() => {});
    };
    fetchPlaytime();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPlaytime();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const handler = () => {
      const val = localStorage.getItem('bonnext_mini_mode') === 'true';
      setIsMiniMode(val);
    };
    window.addEventListener('storage', handler);
    const interval = setInterval(() => {
      const val = localStorage.getItem('bonnext_mini_mode') === 'true';
      if (val !== isMiniMode) setIsMiniMode(val);
    }, 500);
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, [isMiniMode]);

  const handleExitMiniMode = async () => {
    await exitMiniMode();
    setIsMiniMode(false);
  };

  const navigateById = (id: string, params?: Record<string, string>) => {
    if (id === 'instance_detail' && params?.id) {
      routerNavigate(`/instances/${params.id}`);
      return;
    }
    routerNavigate(NAV_ID_TO_PATH[id] || `/${id}`);
  };

  const NAV_ITEMS = [
    { id: 'home', label: t('nav.home'), shortcut: 'H' },
    { id: 'marketplace', label: t('nav.marketplace') || 'Marketplace', shortcut: 'S' },
    { id: 'collections', label: t('nav.collections'), shortcut: 'C' },
    { id: 'instances', label: t('nav.instances'), shortcut: 'I' },
    { id: 'library', label: t('nav.library'), shortcut: 'L' },
    { id: 'versions', label: t('nav.versions'), shortcut: 'V' },
    { id: 'settings', label: t('nav.settings'), shortcut: ',' },
  ];

  useKeyboardShortcuts({
    navigate: navigateById,
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
      if (location.pathname === '/versions') navigateById('versions');
    },
    instances: instState.instances,
    enabled: !!authState.currentUser,
  });

  if (isMiniMode && authState.currentUser) {
    return (
      <ErrorBoundary>
        <MiniMode onExpand={handleExitMiniMode} />
      </ErrorBoundary>
    );
  }

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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="noise-overlay" />
      <div className="scanline-overlay" />
      <div className="app-layout">
        <Sidebar
          navItems={NAV_ITEMS}
          username={authState.currentUser.username}
          accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
          playtimeHours={todayPlaytimeHours}
          totalPlaytimeHours={totalPlaytimeHours}
        />
        <main className="app-main" id="main-content">
          <div className="decorative-rect decorative-rect--top-right" />
          <div className="decorative-rect decorative-rect--bottom-left" />

          <ErrorBoundary>
            <PageTransition>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/home" replace />} />
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
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </Suspense>
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        instances={instState.instances}
        versions={[]}
        navigate={navigateById}
      />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <ConfigProvider>
              <InstanceProvider>
                <ToastProvider>
                  <DownloadProvider>
                    <ContextMenuProvider>
                      <CommandPalette />
                      <AppShell />
                      <DownloadPanel />
                    </ContextMenuProvider>
                  </DownloadProvider>
                </ToastProvider>
              </InstanceProvider>
            </ConfigProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
