import { useState, useEffect } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './stores/authStore';
import { ConfigProvider } from './stores/configStore';
import { InstanceProvider, useInstances } from './stores/instanceStore';
import { ToastProvider } from './stores/toastStore';
import { ThemeProvider } from './stores/themeStore';
import { I18nProvider, useI18n } from './i18n';
import { Sidebar } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ParticleBackground } from './components/ParticleBackground';
import { CommandPalette } from './components/CommandPalette';
import { SearchPalette } from './components/ui/SearchPalette';
import { ContextMenuProvider } from './components/ContextMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import InstanceDetailPage from './pages/InstanceDetailPage';
import NewInstancePage from './pages/NewInstancePage';
import VersionsPage from './pages/VersionsPage';
import ModsPage from './pages/ModsPage';
import StorePage from './pages/StorePage';
import ContentDetailPage from './pages/ContentDetailPage';
import LibraryPage from './pages/LibraryPage';
import CollectionsPage from './pages/CollectionsPage';
import SettingsPage from './pages/SettingsPage';

type Page =
  | 'home'
  | 'instances'
  | 'instance_detail'
  | 'new_instance'
  | 'versions'
  | 'mods'
  | 'store'
  | 'content_detail'
  | 'collections'
  | 'library'
  | 'settings';

function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#/', '').split('?')[0];
  if (hash.startsWith('instances/') && hash.split('/')[1]) return 'instance_detail';
  if (hash === 'instances/new') return 'new_instance';
  if (hash === 'instances') return 'instances';
  if (hash.startsWith('store/') && hash.split('/').length >= 3) return 'content_detail';
  if (hash === 'store') return 'store';
  if (hash === 'versions') return 'versions';
  if (hash === 'mods') return 'mods';
  if (hash === 'collections') return 'collections';
  if (hash === 'library') return 'library';
  if (hash === 'settings') return 'settings';
  return 'home';
}

function AppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { t } = useI18n();
  const [page, setPage] = useState<Page>(getPageFromHash);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (id: string) => {
    const map: Record<string, string> = {
      new_instance: 'instances/new',
      instance_detail: 'instances',
      content_detail: 'store',
    };
    window.location.hash = `#/${map[id] || id}`;
  };

  const NAV_ITEMS = [
    { id: 'home', label: t('nav.home'), shortcut: 'H' },
    { id: 'store', label: t('nav.store'), shortcut: 'S' },
    { id: 'collections', label: t('nav.collections'), shortcut: 'C' },
    { id: 'instances', label: t('nav.instances'), shortcut: 'I' },
    { id: 'mods', label: t('nav.mods'), shortcut: 'M' },
    { id: 'library', label: t('nav.library'), shortcut: 'L' },
    { id: 'versions', label: t('nav.versions'), shortcut: 'V' },
    { id: 'settings', label: t('nav.settings'), shortcut: ',' },
  ];

  useKeyboardShortcuts({
    navigate,
    launchInstance: async (instanceId: string) => {
      const inst = instState.instances.find((i) => i.id === instanceId);
      if (!inst || !authState.currentUser) return;
      try {
        await api.launchGame(
          inst.version_id, inst.version_url,
          authState.currentUser.username, authState.currentUser.uuid,
          authState.currentUser.access_token, inst.max_memory, inst.min_memory,
          inst.java_path || undefined, inst.jvm_args || undefined,
        );
      } catch (e) {
        console.error('Quick launch failed:', e);
      }
    },
    setSearchOpen,
    onRefresh: () => {
      if (page === 'versions') navigate('versions');
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

  const activeNav =
    page === 'new_instance' || page === 'instance_detail' ? 'instances' :
    page === 'content_detail' ? 'store' :
    page;

  return (
    <>
      <div className="noise-overlay" />
      <div className="scanline-overlay" />
      <div className="app-layout">
        <Sidebar
          navItems={NAV_ITEMS}
          activeId={activeNav}
          onNavigate={navigate}
          username={authState.currentUser.username}
          accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
          playtimeHours={0}
        />
        <main className="app-main">
          <div className="decorative-rect decorative-rect--top-right" />
          <div className="decorative-rect decorative-rect--bottom-left" />

          <ErrorBoundary>
            {page === 'home' && <HomePage />}
            {page === 'instances' && <InstancesPage />}
            {page === 'instance_detail' && <InstanceDetailPage />}
            {page === 'new_instance' && <NewInstancePage />}
            {page === 'versions' && <VersionsPage />}
            {page === 'mods' && <ModsPage />}
            {page === 'store' && <StorePage />}
            {page === 'content_detail' && <ContentDetailPage />}
            {page === 'library' && <LibraryPage />}
            {page === 'collections' && <CollectionsPage />}
            {page === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        instances={instState.instances}
        versions={[]}
        navigate={navigate}
      />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <ConfigProvider>
            <InstanceProvider>
              <ToastProvider>
                <ContextMenuProvider>
                  <ParticleBackground />
                  <CommandPalette />
                  <AppShell />
                </ContextMenuProvider>
              </ToastProvider>
            </InstanceProvider>
          </ConfigProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
