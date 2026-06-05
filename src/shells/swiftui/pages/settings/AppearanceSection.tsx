import { useTheme } from '../../../../shared/stores/themeStore';
import { useShellStore } from '../../../../shared/stores/shellStore';
import { ListGroup, ListItem, Toggle } from '../../components/ui';

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { state: shellState, setActiveShell } = useShellStore();
  return (
    <ListGroup label="Appearance">
      <ListItem label="Dark Mode" value={<Toggle checked={theme === 'dark'} onChange={(checked) => setTheme(checked ? 'dark' : 'light')} />} />
      <ListItem label="Shell" value={shellState.activeShell === 'swiftui' ? 'SwiftUI' : 'ZZZ'} onClick={() => setActiveShell(shellState.activeShell === 'swiftui' ? 'zzz' : 'swiftui')} />
    </ListGroup>
  );
}
