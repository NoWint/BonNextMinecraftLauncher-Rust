import { useState, useEffect } from 'react';
import { api } from '../../../../shared/api';
import type { JreVersionInfo } from '../../../../shared/api';
import { SectionCard } from './MemorySection';
import { Button, Badge, StatusDot } from '../../components/ui';
import { Icon } from '../../components/ui/Icon';
import { useI18n } from '../../../../shared/i18n';

interface JreManagementSectionProps {
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}

export default function JreManagementSection({ addToast }: JreManagementSectionProps) {
  const { t } = useI18n();
  const [jreVersions, setJreVersions] = useState<JreVersionInfo[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ downloaded: number; total: number } | null>(null);

  useEffect(() => {
    api
      .listJreVersions()
      .then(setJreVersions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unlisten = api.onJreDownloadProgress((p) => {
      setProgress({ downloaded: p.downloaded, total: p.total });
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const handleDownload = async (version: number) => {
    if (downloading !== null) return;
    setDownloading(version);
    setProgress(null);
    try {
      await api.downloadJreVersionCmd(version);
      addToast({ type: 'success', title: t('settings.jre.toast.downloaded', { version: String(version) }) });
      const versions = await api.listJreVersions();
      setJreVersions(versions);
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('settings.jre.toast.downloadFailed'), message: String(e) });
    } finally {
      setDownloading(null);
      setProgress(null);
    }
  };

  const versionLabel = (v: number) => {
    if (v === 8) return t('settings.jre.version.java8');
    if (v === 11) return t('settings.jre.version.java11');
    if (v === 17) return t('settings.jre.version.java17');
    if (v === 21) return t('settings.jre.version.java21');
    return t('settings.jre.version.other', { version: String(v) });
  };

  return (
    <SectionCard id="sec-jre-management" title={t('settings.jre.title')}>
      <div style={{ fontSize: '0.55em', color: 'var(--color-text-muted)', marginBottom: '0.8em' }}>
        {t('settings.jre.description')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6em' }}>
        {jreVersions.map((jre) => (
          <div
            key={jre.major_version}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.8em',
              padding: '0.6em 0.8em',
              background: 'var(--color-panel-alt)',
              border: `1px solid ${jre.installed ? 'var(--color-accent-30)' : 'var(--color-border-light)'}`,
              clipPath: 'var(--clip-small)',
            }}
          >
            <StatusDot status={jre.installed ? 'ready' : 'inactive'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                <span style={{ fontWeight: 600, fontSize: '0.65em' }}>{versionLabel(jre.major_version)}</span>
                {jre.installed ? (
                  <Badge variant="accent">{t('settings.jre.installed')}</Badge>
                ) : (
                  <Badge variant="default">{t('settings.jre.notInstalled')}</Badge>
                )}
              </div>
              <div style={{ fontSize: '0.5em', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {t('settings.jre.requiredFor')} {jre.required_for.join(', ')}
              </div>
              {jre.path && (
                <div
                  style={{
                    fontSize: '0.45em',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-dim)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {jre.path}
                </div>
              )}
            </div>

            {downloading === jre.major_version && progress && (
              <div style={{ width: 100, flexShrink: 0 }}>
                <div
                  style={{
                    height: 4,
                    background: 'var(--color-border-light)',
                    clipPath: 'var(--clip-badge)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0}%`,
                      background: 'var(--color-accent)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '0.4em',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                  }}
                >
                  {(progress.downloaded / 1_048_576).toFixed(1)} / {(progress.total / 1_048_576).toFixed(1)} MB
                </div>
              </div>
            )}

            {!jre.installed && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownload(jre.major_version)}
                disabled={downloading !== null}
              >
                {downloading === jre.major_version ? (
                  t('common.downloading')
                ) : (
                  <>
                    <Icon name="download" size={12} /> {t('common.install')}
                  </>
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      {jreVersions.length === 0 && (
        <div style={{ fontSize: '0.6em', color: 'var(--color-text-dim)', textAlign: 'center', padding: '1em 0' }}>
          {t('settings.jre.loading')}
        </div>
      )}
    </SectionCard>
  );
}
