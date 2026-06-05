import { useState, useEffect } from 'react';
import { api } from '../../../../shared/api';
import { formatError } from '../../../../shared/utils/errorMapping';
import { Button, Checkbox, ContextHelp } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';
import styles from '../SettingsPage.module.css';

interface UrlConfig {
  git_proxy_enabled: boolean;
  git_proxy_url: string;
}

export default function NetworkSection({
  t,
  addToast,
}: {
  t: (key: string, params?: Record<string, string>) => string;
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}) {
  const [urlConfig, setUrlConfig] = useState<UrlConfig | null>(null);
  const [proxyUrl, setProxyUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    api.getUrlConfig().then((cfg) => {
      setUrlConfig(cfg);
      setProxyUrl(cfg.git_proxy_url);
    }).catch(() => {});
  }, []);

  const handleToggleProxy = async (enabled: boolean) => {
    try {
      await api.setGitProxy(enabled, proxyUrl || null);
      setUrlConfig((prev) => prev ? { ...prev, git_proxy_enabled: enabled } : prev);
      addToast({ type: 'success', title: t('settings.saved') || 'Saved' });
    } catch (e) {
      addToast({ type: 'error', title: t('settings.saveFailed') || 'Save failed', message: formatError(e) });
    }
  };

  const handleSaveProxyUrl = async () => {
    try {
      await api.setGitProxy(urlConfig?.git_proxy_enabled ?? false, proxyUrl || null);
      setUrlConfig((prev) => prev ? { ...prev, git_proxy_url: proxyUrl } : prev);
      addToast({ type: 'success', title: t('settings.saved') || 'Saved' });
    } catch (e) {
      addToast({ type: 'error', title: t('settings.saveFailed') || 'Save failed', message: formatError(e) });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setLatency(null);
    setTestError('');
    try {
      const start = performance.now();
      const resp = await fetch('https://api.github.com/zen', {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      const elapsed = Math.round(performance.now() - start);
      if (resp.ok) {
        setLatency(elapsed);
      } else {
        setTestError(`HTTP ${resp.status}`);
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  if (!urlConfig) return null;

  return (
    <SectionCard id="sec-network" title={t('settings.network') || 'Network'}>
      <SettingRow label={t('settings.gitProxy') || 'GitHub Proxy'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ContextHelp
            content={
              t('settings.gitProxyHelp') ||
              'Route GitHub content downloads through a proxy mirror. This helps in regions where GitHub access is restricted. Only affects github.com content URLs, not the API.'
            }
          />
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={urlConfig.git_proxy_enabled}
              onChange={() => handleToggleProxy(!urlConfig.git_proxy_enabled)}
            />
            <span
              className={
                urlConfig.git_proxy_enabled ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']
              }
            >
              {urlConfig.git_proxy_enabled
                ? t('settings.gitProxyEnabled') || 'Enabled'
                : t('settings.gitProxyDisabled') || 'Disabled'}
            </span>
          </label>
        </div>
      </SettingRow>

      {urlConfig.git_proxy_enabled && (
        <SettingRow label={t('settings.gitProxyUrl') || 'Proxy URL'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://gh-proxy.com"
              style={{
                flex: 1,
                background: 'var(--color-panel-alt)',
                border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6em',
                padding: '4px 8px',
                outline: 'none',
                clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
              }}
            />
            <Button variant="primary" size="sm" onClick={handleSaveProxyUrl}>
              {t('common.save') || 'Save'}
            </Button>
          </div>
        </SettingRow>
      )}

      <SettingRow label={t('settings.testConnection') || 'Test Connection'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button variant="secondary" size="sm" disabled={testing} onClick={handleTestConnection}>
            {testing ? t('common.loading') || 'Testing...' : t('settings.testConnection') || 'Test Connection'}
          </Button>
          {latency !== null && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55em',
                color: latency < 300 ? '#38a169' : latency < 800 ? '#ecc94b' : '#e53e3e',
              }}
            >
              {latency} ms
            </span>
          )}
          {testError && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55em', color: '#e53e3e' }}>
              {testError}
            </span>
          )}
        </div>
      </SettingRow>
    </SectionCard>
  );
}
