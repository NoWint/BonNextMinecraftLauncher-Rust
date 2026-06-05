import { Suspense } from 'react';
import { getShellComponent } from './shell-registry';
import { AppProviders } from './shared/utils/composeProviders';
import { useShellStore } from './shared/stores/shellStore';

function ShellLoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div>Loading Shell...</div>
    </div>
  );
}

function ShellRenderer() {
  const { state } = useShellStore();
  const ShellComponent = getShellComponent(state.activeShell);

  return (
    <Suspense fallback={<ShellLoadingScreen />}>
      <ShellComponent />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProviders>
      <ShellRenderer />
    </AppProviders>
  );
}
