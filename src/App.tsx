import { Suspense, lazy } from 'react';
import { AppProviders } from './shared/utils/composeProviders';
import { ShellErrorBoundary } from './shared/components/ShellErrorBoundary';
import { useShellStore } from './shared/stores/shellStore';

// 默认 Shell（ZZZ）直接导入：它是 99% 用户使用的 Shell，
// 懒加载会导致每次启动都显示 "NOWINT PRESENT" 加载屏，增加 1-2 秒延迟。
import ZZZAppShell from './shells/zzz/AppShell';

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

  // ZZZ Shell 直接渲染（已 eager import），备选 Shell 走 Suspense 懒加载。
  if (state.activeShell === 'zzz' || (state.activeShell !== 'swiftui' && state.activeShell !== 'editor')) {
    return (
      <ShellErrorBoundary onFallback={handleFallback}>
        <ZZZAppShell />
      </ShellErrorBoundary>
    );
  }

  let ShellComponent: React.LazyExoticComponent<React.ComponentType>;
  switch (state.activeShell) {
    case 'swiftui':
      ShellComponent = SwiftUIAppShell;
      break;
    case 'editor':
      ShellComponent = EditorAppShell;
      break;
    default:
      ShellComponent = SwiftUIAppShell;
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
