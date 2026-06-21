// src/shells/zzz/pages/settings/AboutSection.tsx
// 关于 / 检查更新 section：显示当前版本号，提供手动检查更新入口。
import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { api, type AppUpdateInfo } from '../../../../shared/api';
import { useI18n } from '../../../../shared/i18n';
import { useToast } from '../../../../shared/stores/toastStore';
import { formatError } from '../../../../shared/utils/errorMapping';
import { SectionCard, SettingRow } from './MemorySection';
import { Button, Badge, StatusDot } from '../../components/ui';
import UpdateBanner, { getSkippedVersion } from '../../components/ui/UpdateBanner';

export function AboutSection() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [currentVersion, setCurrentVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion('unknown'));
  }, []);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const info = await api.checkForUpdates();
      if (info) {
        const skipped = getSkippedVersion();
        if (skipped === info.version) {
          addToast({ type: 'info', title: t('updateBanner.available') + ` v${info.version} (skipped)` });
        } else {
          setUpdateInfo(info);
          setBannerVisible(true);
          addToast({ type: 'success', title: t('updateBanner.available') + ` v${info.version}` });
        }
      } else {
        setUpdateInfo(null);
        setBannerVisible(false);
        addToast({ type: 'success', title: t('settings.about.upToDate') || 'Already up to date' });
      }
    } catch (e) {
      addToast({ type: 'error', title: t('settings.about.checkFailed') || 'Update check failed', message: formatError(e) });
    } finally {
      setChecking(false);
    }
  }, [t, addToast]);

  return (
    <SectionCard id="sec-about" title={t('settings.about.title') || 'About'}>
      <SettingRow label={t('settings.about.currentVersion') || 'Current Version'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <Badge variant="accent">v{currentVersion || '...'}</Badge>
          {updateInfo && (
            <span style={{ fontSize: '0.55em', color: 'var(--color-text-muted)' }}>
              → v{updateInfo.version}
            </span>
          )}
        </div>
      </SettingRow>

      <SettingRow label={t('settings.about.checkForUpdates') || 'Check for Updates'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <Button variant="primary" size="sm" onClick={handleCheck} disabled={checking}>
            {checking
              ? t('settings.about.checking') || 'Checking...'
              : t('settings.about.checkNow') || 'Check Now'}
          </Button>
          {updateInfo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3em', fontSize: '0.55em' }}>
              <StatusDot status="processing" />
              <span>{t('settings.about.updateAvailable') || 'Update available'}: v{updateInfo.version}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3em', fontSize: '0.55em', color: 'var(--color-text-muted)' }}>
              <StatusDot status="ready" />
              <span>{t('settings.about.upToDate') || 'Up to date'}</span>
            </div>
          )}
        </div>
      </SettingRow>

      {bannerVisible && updateInfo && (
        <div style={{ marginTop: '0.8em' }}>
          <UpdateBanner updateInfo={updateInfo} onDismiss={() => setBannerVisible(false)} />
        </div>
      )}

      {updateInfo?.body && !bannerVisible && (
        <SettingRow label={t('updateBanner.changelog') || 'Changelog'}>
          <div
            style={{
              fontSize: '0.55em',
              color: 'var(--color-text-secondary)',
              maxHeight: '12em',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              padding: '0.5em',
              background: 'var(--color-panel-alt)',
              borderRadius: '4px',
            }}
          >
            {updateInfo.body}
          </div>
        </SettingRow>
      )}
    </SectionCard>
  );
}

export default AboutSection;
