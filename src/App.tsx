import { Suspense, lazy } from 'react';
import { AppProviders } from './shared/utils/composeProviders';
import { ShellErrorBoundary } from './shared/components/ShellErrorBoundary';
import { useShellStore } from './shared/stores/shellStore';

// 核心 UI：ZZZ Shell（默认且唯一的内置 Shell）
const ZZZAppShell = lazy(() => import('./shells/zzz/AppShell'));

// 备选 Shell：通过 shell-registry 懒加载（Swift Shell / Editor Shell 等）
// 这些 Shell 作为插件保留，可通过设置页切换。
const SwiftUIAppShell = lazy(() => import('./shells/swiftui/AppShell').then((m) => ({ default: m.default })));
const EditorAppShell = lazy(() => import('./shells/editor/AppShell').then((m) => ({ default: m.default })));

function ShellLoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif',
      letterSpacing: '0.15em',
      fontSize: '1.1em',
      fontWeight: 300,
      textTransform: 'uppercase',
    }}>
      <div>NOWINT PRESENT</div>
    </div>
  );
}

function ShellRenderer() {
  const { state, setActiveShell } = useShellStore();

  const handleFallback = () => {
    setActiveShell('zzz');
  };

  // 选择当前 Shell 组件
  let ShellComponent: React.LazyExoticComponent<React.ComponentType>;
  switch (state.activeShell) {
    case 'swiftui':
      ShellComponent = SwiftUIAppShell;
      break;
    case 'editor':
      ShellComponent = EditorAppShell;
      break;
    case 'zzz':
    default:
      ShellComponent = ZZZAppShell;
      break;
  }

  return (
    <ShellErrorBoundary onFallback={handleFallback}>
      <Suspense fallback={<ShellLoadingScreen />}>
        <ShellComponent />
      </Suspense>
    </ShellErrorBoundary>
  );
}

export default function App() {
  return (
    <AppProviders>
      <ShellRenderer />
    </AppProviders>
  );
}
