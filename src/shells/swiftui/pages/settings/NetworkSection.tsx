import { useState, useEffect } from 'react';
import { ListGroup, ListItem, Toggle } from '../../components/ui';
import { api } from '../../../../shared/api';

export function NetworkSection() {
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    api.getUrlConfig().then((cfg) => {
      setProxyEnabled(cfg.git_proxy_enabled);
      setProxyUrl(cfg.git_proxy_url);
      setUrlInput(cfg.git_proxy_url);
    }).catch(() => {});
  }, []);

  const handleToggle = async (checked: boolean) => {
    setProxyEnabled(checked);
    try {
      await api.setGitProxy(checked, checked ? proxyUrl || urlInput : null);
    } catch {
      setProxyEnabled(!checked);
    }
  };

  const handleUrlChange = async () => {
    setProxyUrl(urlInput);
    if (proxyEnabled) {
      try {
        await api.setGitProxy(true, urlInput);
      } catch { /* ignore */ }
    }
  };

  return (
    <ListGroup label="Network">
      <ListItem label="Proxy" value={<Toggle checked={proxyEnabled} onChange={handleToggle} />} />
      {proxyEnabled && (
        <>
          <ListItem
            label="Proxy URL"
            value={
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={handleUrlChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlChange(); }}
                placeholder="http://127.0.0.1:7890"
                style={{ background: 'var(--swift-bg-secondary)', border: '1px solid var(--swift-border)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 'inherit', width: 200 }}
              />
            }
          />
        </>
      )}
    </ListGroup>
  );
}
