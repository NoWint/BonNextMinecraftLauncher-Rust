import { useState, useEffect } from 'react';
import { api } from '../../../../shared/api';
import { formatError } from '../../../../shared/utils/errorMapping';
import { Button, Select, Checkbox } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';
import styles from '../SettingsPage.module.css';

export default function DownloadSection({
  t,
  addToast,
}: {
  t: (key: string, params?: Record<string, string>) => string;
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}) {
  const [downloadConfig, setDownloadConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('bonnext_download_config');
      return saved ? JSON.parse(saved) : { maxSpeed: 0, pauseDuringGame: true, priority: 'normal' };
    } catch {
      return { maxSpeed: 0, pauseDuringGame: true, priority: 'normal' };
    }
  });

  const [downloadSource, setDownloadSource] = useState('bmclapi');
  const [selectingMirror, setSelectingMirror] = useState(false);
  const [savingSource, setSavingSource] = useState(false);

  useEffect(() => {
    api.getActiveDownloadSource().then(setDownloadSource).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_download_config', JSON.stringify(downloadConfig));
    } catch {
      /* empty */
    }
  }, [downloadConfig]);

  const handleSaveDownloadConfig = async () => {
    try {
      await api.setDownloadScheduleConfig({
        max_speed_bytes: downloadConfig.maxSpeed * 1_048_576,
        active_during_game: !downloadConfig.pauseDuringGame,
        priority: downloadConfig.priority,
      });
      addToast({ type: 'success', title: t('settings.saved') });
    } catch (e) {
      addToast({ type: 'error', title: t('settings.saveFailed'), message: formatError(e) });
    }
  };

  const handleSourceChange = async (newSource: string) => {
    setSavingSource(true);
    try {
      const config = await api.getConfig();
      config.download_source = newSource;
      await api.saveConfig(config);
      setDownloadSource(newSource);
      addToast({ type: 'success', title: t('settings.downloadSourceChanged') });
    } catch (e) {
      addToast({ type: 'error', title: t('settings.saveFailed'), message: formatError(e) });
    } finally {
      setSavingSource(false);
    }
  };

  const handleSelectFastest = async () => {
    setSelectingMirror(true);
    try {
      const best = await api.selectFastestMirror();
      setDownloadSource(best);
      addToast({ type: 'success', title: t('settings.fastestMirrorSelected'), message: best });
    } catch (e) {
      addToast({ type: 'error', title: t('settings.fastestMirrorFailed'), message: formatError(e) });
    } finally {
      setSelectingMirror(false);
    }
  };

  return (
    <SectionCard id="sec-download" title={t('settings.download')}>
      <SettingRow label={t('settings.downloadSource')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ minWidth: 160 }}>
            <Select
              value={downloadSource}
              onChange={(e) => handleSourceChange(e.target.value)}
              disabled={savingSource}
              options={[
                { value: 'bmclapi', label: 'BMCLAPI (' + t('settings.mirrorChina') + ')' },
                { value: 'mcbbs', label: 'MCBBS (' + t('settings.mirrorChina') + ')' },
                { value: 'official', label: t('settings.sourceOfficial') },
              ]}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={selectingMirror}
            onClick={handleSelectFastest}
          >
            {selectingMirror ? t('settings.selecting') : t('settings.selectFastest')}
          </Button>
        </div>
      </SettingRow>
      <SettingRow label={t('settings.downloadSpeed')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <input
            type="number"
            min={0}
            step={0.5}
            value={downloadConfig.maxSpeed}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value));
              setDownloadConfig({ ...downloadConfig, maxSpeed: val });
            }}
            style={{
              width: 80,
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5em', color: 'var(--color-text-muted)' }}>
            {downloadConfig.maxSpeed === 0 ? t('settings.downloadUnlimited') : 'MB/s'}
          </span>
        </div>
      </SettingRow>
      <SettingRow label={t('settings.downloadPauseDuringGame')}>
        <label className={styles.checkboxLabel}>
          <Checkbox
            on={downloadConfig.pauseDuringGame}
            onChange={() => setDownloadConfig({ ...downloadConfig, pauseDuringGame: !downloadConfig.pauseDuringGame })}
          />
          <span
            className={
              downloadConfig.pauseDuringGame ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']
            }
          >
            {t('settings.downloadPauseDuringGame')}
          </span>
        </label>
      </SettingRow>
      <SettingRow label={t('settings.downloadPriority')}>
        <div style={{ minWidth: 160 }}>
          <Select
            value={downloadConfig.priority}
            onChange={(e) => {
              const next = { ...downloadConfig, priority: e.target.value };
              setDownloadConfig(next);
            }}
            options={[
              { value: 'low', label: t('settings.downloadPriorityLow') },
              { value: 'normal', label: t('settings.downloadPriorityNormal') },
              { value: 'high', label: t('settings.downloadPriorityHigh') },
            ]}
          />
        </div>
      </SettingRow>
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={handleSaveDownloadConfig}>
          {t('common.save')}
        </Button>
      </div>
    </SectionCard>
  );
}
