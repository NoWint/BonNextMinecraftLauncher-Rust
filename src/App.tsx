import { Suspense, useCallback } from 'react';
import { getShellComponent } from './shell-registry';
import { AppProviders } from './shared/utils/composeProviders';
import { useShellStore } from './shared/stores/shellStore';
import { ShellErrorBoundary } from './shared/components/ShellErrorBoundary';

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
  const ShellComponent = getShellComponent(state.activeShell);

  const handleFallback = useCallback(() => {
    setActiveShell('zzz');
  }, [setActiveShell]);

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
