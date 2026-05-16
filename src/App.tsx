import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './stores/authStore';
import { ConfigProvider } from './stores/configStore';
import { InstanceProvider } from './stores/instanceStore';
import { ToastProvider } from './stores/toastStore';
import { Sidebar } from './components/layout';
import { ToastContainer } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboard';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import InstanceDetailPage from './pages/InstanceDetailPage';
import NewInstancePage from './pages/NewInstancePage';
import VersionsPage from './pages/VersionsPage';
import ModsPage from './pages/ModsPage';
import SettingsPage from './pages/SettingsPage';

type Page =
  | 'home'
  | 'instances'
  | 'instance_detail'
  | 'new_instance'
  | 'versions'
  | 'mods'
  | 'settings';

const NAV_ITEMS = [
  { id: 'home', label: '主页', shortcut: 'H' },
  { id: 'instances', label: '实例管理', shortcut: 'I' },
  { id: 'mods', label: '模组市场', shortcut: 'M' },
  { id: 'versions', label: '版本列表', shortcut: 'V' },
  { id: 'settings', label: '设置', shortcut: ',' },
];

function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#/', '').split('?')[0];
  if (hash.startsWith('instances/') && hash.split('/')[1]) return 'instance_detail';
  if (hash === 'instances/new') return 'new_instance';
  if (hash === 'instances') return 'instances';
  if (hash === 'versions') return 'versions';
  if (hash === 'mods') return 'mods';
  if (hash === 'settings') return 'settings';
  return 'home';
}

function AppShell() {
  const { state: authState } = useAuth();
  const [page, setPage] = useState<Page>(getPageFromHash);

  useEffect(() => {
    const onHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (id: string) => {
    const map: Record<string, string> = {
      new_instance: 'instances/new',
      instance_detail: 'instances',
    };
    window.location.hash = `#/${map[id] || id}`;
  };

  useKeyboardShortcuts([
    { key: 'h', ctrl: true, handler: () => navigate('home'), description: 'Go home' },
    { key: 'i', ctrl: true, handler: () => navigate('instances'), description: 'Instances' },
    { key: 'm', ctrl: true, handler: () => navigate('mods'), description: 'Mod browser' },
    { key: 'v', ctrl: true, handler: () => navigate('versions'), description: 'Versions' },
    { key: ',', ctrl: true, handler: () => navigate('settings'), description: 'Settings' },
    { key: 'n', ctrl: true, handler: () => navigate('new_instance'), description: 'New instance' },
  ]);

  if (!authState.currentUser) {
    return (
      <ErrorBoundary>
        <div className="noise-overlay" />
        <div className="scanline-overlay" />
        <LoginPage />
      </ErrorBoundary>
    );
  }

  const activeNav = page === 'new_instance' || page === 'instance_detail' ? 'instances' : page;

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
            {page === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <InstanceProvider>
          <ToastProvider>
            <AppShell />
            <ToastContainer />
          </ToastProvider>
        </InstanceProvider>
      </ConfigProvider>
    </AuthProvider>
  );
}
