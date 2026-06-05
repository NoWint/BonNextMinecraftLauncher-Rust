import { useState, useEffect } from 'react';
import { api } from '../../../../shared/api';
import { Checkbox } from '../../components/ui';
import { SectionCard, SettingRow } from './MemorySection';
import styles from '../SettingsPage.module.css';

export default function DiscordSection({ t }: { t: (key: string, params?: Record<string, string>) => string }) {
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(() => {
    try {
      return localStorage.getItem('bonnext_discord_rpc') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bonnext_discord_rpc', String(discordRpcEnabled));
    } catch {
      /* empty */
    }
  }, [discordRpcEnabled]);

  const handleDiscordRpcToggle = async () => {
    const next = !discordRpcEnabled;
    setDiscordRpcEnabled(next);
    try {
      if (next) {
        await api.startDiscordRpc();
      } else {
        await api.stopDiscordRpc();
      }
    } catch {
      /* empty */
    }
  };

  return (
    <SectionCard id="sec-discord" title={t('settings.discord')}>
      <SettingRow label={t('settings.discordRpc')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <label className={styles.checkboxLabel}>
            <Checkbox on={discordRpcEnabled} onChange={handleDiscordRpcToggle} />
            <span className={styles.checkboxLabel__text}>
              {discordRpcEnabled ? t('settings.discordEnabled') : t('settings.discordDisabled')}
            </span>
          </label>
          <span style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', marginLeft: 8 }}>
            {t('settings.discordDesc')}
          </span>
        </div>
      </SettingRow>
    </SectionCard>
  );
}
