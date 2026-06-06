import { ListGroup, ListItem } from '../../components/ui';
import { useConfig } from '../../../../shared/stores/configStore';

export function DownloadSection() {
  const { state, updateConfigOptimistic } = useConfig();
  const config = state.config;

  if (!config) return null;

  const handleConcurrentChange = async (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      await updateConfigOptimistic({ max_concurrent_downloads: num });
    }
  };

  const handleSourceChange = async (val: string) => {
    await updateConfigOptimistic({ download_source: val });
  };

  return (
    <ListGroup label="Downloads">
      <ListItem
        label="Concurrent Downloads"
        value={
          <select
            value={String(config.max_concurrent_downloads)}
            onChange={(e) => handleConcurrentChange(e.target.value)}
            style={{ background: 'var(--swift-bg-secondary)', border: '1px solid var(--swift-border)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 'inherit' }}
          >
            {[1, 2, 4, 8, 16].map((n) => (
              <option key={n} value={String(n)}>{n}</option>
            ))}
          </select>
        }
      />
      <ListItem
        label="Mirror"
        value={
          <select
            value={config.download_source}
            onChange={(e) => handleSourceChange(e.target.value)}
            style={{ background: 'var(--swift-bg-secondary)', border: '1px solid var(--swift-border)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 'inherit' }}
          >
            <option value="official">Official</option>
            <option value="bmclapi">BMCLAPI</option>
          </select>
        }
      />
    </ListGroup>
  );
}
