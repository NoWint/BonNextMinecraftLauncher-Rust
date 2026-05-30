import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode, Component } from 'react';
import type { LayoutContribution } from '@/plugins/extensions';
import { useAuth } from '@/stores/authStore';
import type { IconName } from '@/components/ui/Icon';
import LoginPage from '@/pages/LoginPage';
import s from './MD3AppShell.module.css';

const HomePage = lazy(() => import('@/pages/HomePage'));
const InstancesPage = lazy(() => import('@/pages/InstancesPage'));
const InstanceDetailPage = lazy(() => import('@/pages/InstanceDetailPage'));
const NewInstancePage = lazy(() => import('@/pages/NewInstancePage'));
const VersionsPage = lazy(() => import('@/pages/VersionsPage'));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));
const ContentDetailPage = lazy(() => import('@/pages/ContentDetailPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '1em', color: 'var(--md-sys-color-error)' }}>Something went wrong</div>;
    }
    return this.props.children;
  }
}

function PageSkeleton() {
  return (
    <div style={{ padding: '1em', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
      <div
        style={{
          width: '40%',
          height: '1.5em',
          background: 'var(--md-sys-color-surface-container-high)',
          borderRadius: '8px',
        }}
      />
      <div
        style={{
          width: '100%',
          height: '12em',
          background: 'var(--md-sys-color-surface-container-high)',
          borderRadius: '12px',
        }}
      />
    </div>
  );
}

const NAV_ITEMS: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'store', label: 'Store', icon: 'store' },
  { id: 'mods', label: 'Mods', icon: 'puzzle' },
  { id: 'instances', label: 'Instances', icon: 'cube' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'collections', label: 'Collections', icon: 'star' },
  { id: 'versions', label: 'Versions', icon: 'clipboard' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const NAV_PATH_MAP: Record<string, string> = {
  home: '/home',
  store: '/store',
  mods: '/mods',
  instances: '/instances',
  library: '/library',
  collections: '/collections',
  versions: '/versions',
  settings: '/settings',
};

interface MD3AppShellProps {
  layout: LayoutContribution;
}

export function MD3AppShell({ layout }: MD3AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  const activeNavId = (() => {
    const path = location.pathname;
    for (const [id, navPath] of Object.entries(NAV_PATH_MAP)) {
      if (path === navPath || path.startsWith(navPath + '/')) return id;
    }
    return 'home';
  })();

  const pageTitle = NAV_ITEMS.find((i) => i.id === activeNavId)?.label || 'BonNext';

  const handleNavigate = (id: string) => {
    navigate(NAV_PATH_MAP[id] || `/${id}`);
  };

  const content = !authState.currentUser ? (
    <LoginPage />
  ) : (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );

  return (
    <div className={s.shell}>
      <layout.TopAppBar title={pageTitle} onSearchClick={() => {}} onSettingsClick={() => navigate('/settings')} />
      <div className={s.layout}>
        <layout.NavigationRail
          items={NAV_ITEMS}
          activeId={activeNavId}
          onNavigate={handleNavigate}
          fabIcon="play"
          fabLabel="Launch"
          onFabClick={() => {}}
        />
        <main className={s.main}>{content}</main>
      </div>
    </div>
  );
}
