import { useState } from 'react';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { testConnection } from '../../shared/ai/api';
import { SectionCard, SettingRow } from './MemorySection';
import { Button, Checkbox, TextInput } from '../../components/ui';
import { Icon } from '../../components/ui/Icon';
import { useI18n } from '../../shared/i18n';
import styles from '../SettingsPage.module.css';

export default function AISection() {
  const { t } = useI18n();
  const { state, updateConfig } = useAIAssistant();
  const { config } = state;
  const [localConfig, setLocalConfig] = useState(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleChange = (updates: Partial<typeof config>) => {
    const next = { ...localConfig, ...updates };
    setLocalConfig(next);
    updateConfig(next);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(localConfig);
    setTestResult(result);
    setTesting(false);
  };

  return (
    <SectionCard id="sec-ai-assistant" title={t('settings.ai.title')}>
      <SettingRow label={t('settings.ai.enable')}>
        <label className={styles.checkboxLabel}>
          <Checkbox on={localConfig.enabled} onChange={() => handleChange({ enabled: !localConfig.enabled })} />
          <span className={localConfig.enabled ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
            {t('settings.ai.enableDesc')}
          </span>
        </label>
      </SettingRow>

      <SettingRow label="API URL">
        <div style={{ flex: 1 }}>
          <TextInput
            value={localConfig.api_url}
            onChange={(e) => handleChange({ api_url: e.target.value })}
            placeholder="http://127.0.0.1:7860/v1/chat/completions"
          />
        </div>
      </SettingRow>

      <SettingRow label="API Key">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={localConfig.api_key}
              onChange={(e) => handleChange({ api_key: e.target.value })}
              placeholder="sk-..."
              className={styles.textInput}
              style={{ width: '100%', paddingRight: '3em' }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                position: 'absolute',
                right: '0.5em',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '0.5em',
              }}
            >
              {showApiKey ? t('common.hide') : t('common.show')}
            </button>
          </div>
        </div>
      </SettingRow>

      <SettingRow label={t('settings.ai.modelName')}>
        <div style={{ flex: 1 }}>
          <TextInput
            value={localConfig.model}
            onChange={(e) => handleChange({ model: e.target.value })}
            placeholder={t('settings.ai.modelPlaceholder')}
          />
        </div>
      </SettingRow>

      <SettingRow label={t('settings.ai.connectionTest')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? t('settings.ai.testing') : t('settings.ai.testConnection')}
          </Button>
          {testResult && (
            <span
              style={{
                fontSize: '0.55em',
                fontFamily: 'var(--font-mono)',
                color: testResult.ok ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {testResult.ok ? (
                <>
                  {' '}
                  <Icon name="check" size={12} /> {t('settings.ai.connectionSuccess')}
                </>
              ) : (
                <>
                  {' '}
                  <Icon name="cross" size={12} /> {testResult.message}
                </>
              )}
            </span>
          )}
        </div>
      </SettingRow>
    </SectionCard>
  );
}
