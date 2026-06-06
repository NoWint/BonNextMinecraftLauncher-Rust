import { ListGroup, ListItem, Toggle } from '../../components/ui';
import { useConfig } from '../../../../shared/stores/configStore';

export function SecuritySection() {
  const { state, updateConfigOptimistic } = useConfig();
  const config = state.config;

  if (!config) return null;

  const sandboxEnabled = config.security?.sandbox_mode === 'enabled';

  const handleToggle = async (checked: boolean) => {
    await updateConfigOptimistic({
      security: {
        ...config.security,
        sandbox_mode: checked ? 'enabled' : 'disabled',
      },
    });
  };

  return (
    <ListGroup label="Security">
      <ListItem label="Sandbox Mode" value={<Toggle checked={sandboxEnabled} onChange={handleToggle} />} />
    </ListGroup>
  );
}
