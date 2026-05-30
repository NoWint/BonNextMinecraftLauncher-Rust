import { useState, useEffect, useMemo } from 'react';
import { api, type YggdrasilTexturesValue, type StoredAccount, type McSkinInfo } from '../../api';
import { useAuth } from '../../stores/authStore';
import { useI18n } from '../../i18n';
import { StatusDot, Badge, Button, TextInput, Select, SkinViewer3D } from '../../components/ui';
import { useFormField } from '../../hooks/useFormField';
import { url } from '../../utils/validators';
import formStyles from '../../components/ui/FormField.module.css';
import { SectionCard, SettingRow } from './MemorySection';
import { open } from '@tauri-apps/plugin-dialog';
import { formatError } from '../../utils/errorMapping';
import styles from '../SettingsPage.module.css';

export default function SkinStationSection({
  addToast,
}: {
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}) {
  const { t } = useI18n();
  const { state: authState, yggdrasilLogin, refreshAccounts } = useAuth();
  const [presets, setPresets] = useState<[string, string][]>([]);
  const [selectedPreset, setSelectedPreset] = useState('https://littleskin.cn/api/yggdrasil');
  const [customUrl, setCustomUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const yggdrasilUrlRules = useMemo(() => [url], []);
  const yggdrasilUrlField = useFormField(customUrl, yggdrasilUrlRules);
  const [loginError, setLoginError] = useState('');
  const [activeAccount, setActiveAccount] = useState<StoredAccount | null>(null);
  const [yggdrasilAccount, setYggdrasilAccount] = useState<StoredAccount | null>(null);
  const [microsoftAccount, setMicrosoftAccount] = useState<StoredAccount | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [localSkinUrl, setLocalSkinUrl] = useState<string | null>(null);
  const [capeUrl, setCapeUrl] = useState<string | null>(null);
  const [skinModel, setSkinModel] = useState<'default' | 'slim'>('default');
  const [uploading, setUploading] = useState(false);
  const [authlibStatus, setAuthlibStatus] = useState<'idle' | 'downloading' | 'ready'>('idle');
  const [msSkins, setMsSkins] = useState<McSkinInfo[]>([]);
  const [msCapeAlias, setMsCapeAlias] = useState<string | null>(null);
  const [msLoading, setMsLoading] = useState(false);

  const serverUrl = selectedPreset === '' ? customUrl : selectedPreset;

  useEffect(() => {
    api
      .getYggdrasilPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const acct = authState.accounts.find((a: StoredAccount) => a.id === authState.activeAccountId) || null;
    setActiveAccount(acct);
    const ygg =
      acct?.account_type === 'yggdrasil'
        ? acct
        : authState.accounts.find((a: StoredAccount) => a.account_type === 'yggdrasil') || null;
    setYggdrasilAccount(ygg);
    const ms = acct?.account_type === 'microsoft' ? acct : null;
    setMicrosoftAccount(ms);
  }, [authState.accounts, authState.activeAccountId]);

  useEffect(() => {
    api
      .checkAuthlibInjector()
      .then((result) => {
        if (result.ready) setAuthlibStatus('ready');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeAccount?.local_skin_path) {
      api
        .readSkinFile(activeAccount.local_skin_path)
        .then((b64) => {
          setLocalSkinUrl(`data:image/png;base64,${b64}`);
        })
        .catch(() => setLocalSkinUrl(null));
      if (activeAccount.local_skin_model === 'slim') setSkinModel('slim');
    } else {
      setLocalSkinUrl(null);
    }
  }, [activeAccount?.local_skin_path, activeAccount?.local_skin_model]);

  const fetchYggdrasilProfile = () => {
    if (!yggdrasilAccount?.uuid || !yggdrasilAccount?.yggdrasil_server_url || !yggdrasilAccount?.access_token) {
      setSkinUrl(null);
      setCapeUrl(null);
      return;
    }
    api
      .yggdrasilGetProfile(yggdrasilAccount.uuid, yggdrasilAccount.yggdrasil_server_url, yggdrasilAccount.access_token)
      .then((profile) => {
        const texturesProp = profile.properties.find((p) => p.name === 'textures');
        if (texturesProp) {
          try {
            const decoded: YggdrasilTexturesValue = JSON.parse(atob(texturesProp.value));
            setSkinUrl(decoded.textures.SKIN?.url || null);
            if (decoded.textures.SKIN?.metadata?.model === 'slim') setSkinModel('slim');
            setCapeUrl(decoded.textures.CAPE?.url || null);
          } catch {
            console.warn('[SkinStation] Failed to decode skin textures');
          }
        }
      })
      .catch((e: unknown) => console.warn('[SkinStation] Failed to fetch Yggdrasil profile:', e));
  };

  useEffect(() => {
    fetchYggdrasilProfile();
  }, [yggdrasilAccount]);

  const fetchMicrosoftProfile = () => {
    if (!microsoftAccount?.access_token) return;
    setMsLoading(true);
    api
      .microsoftGetSkinProfile(microsoftAccount.access_token)
      .then((profile) => {
        setMsSkins(profile.skins);
        const activeSkin = profile.skins.find((s: McSkinInfo) => s.state === 'ACTIVE');
        if (activeSkin) {
          setSkinUrl(activeSkin.url);
          if (activeSkin.variant === 'SLIM') setSkinModel('slim');
        }
        const activeCape = profile.capes.find((c: { state: string }) => c.state === 'ACTIVE');
        setMsCapeAlias(activeCape?.alias || null);
        if (activeCape) setCapeUrl(activeCape.url);
      })
      .catch((e: unknown) => console.warn('[SkinStation] Failed to fetch Microsoft profile:', e))
      .finally(() => setMsLoading(false));
  };

  useEffect(() => {
    if (microsoftAccount) fetchMicrosoftProfile();
  }, [microsoftAccount]);

  const handleLogin = async () => {
    if (!serverUrl || !email || !password) {
      setLoginError(t('skinStation.fillAllFields'));
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const result = await yggdrasilLogin(serverUrl, email, password);
      addToast({
        type: 'success',
        title: t('skinStation.loginSuccess'),
        message: t('skinStation.welcome', { name: result.username }),
      });
      setPassword('');
      await refreshAccounts();
    } catch (e: unknown) {
      const raw = formatError(e);
      let msg = raw;
      if (raw.includes('ForbiddenOperationException')) msg = t('skinStation.errorWrongPassword');
      else if (raw.includes('RateLimitedException')) msg = t('skinStation.errorRateLimited');
      else if (raw.includes('ResourceNotFoundException')) msg = t('skinStation.errorServerNotFound');
      else if (raw.includes('Invalid email or password')) msg = t('skinStation.errorWrongPassword');
      else if (raw.includes('Session expired')) msg = t('skinStation.errorSessionExpired');
      else if (raw.includes('No game profile')) msg = t('skinStation.errorNoProfile');
      else if (raw.includes('connection') || raw.includes('timeout') || raw.includes('network'))
        msg = t('skinStation.errorNetwork');
      else if (raw.includes('Authentication failed')) msg = raw.replace('Authentication failed: ', '');
      setLoginError(msg || t('skinStation.loginFailed'));
    } finally {
      setLoggingIn(false);
    }
  };

  const validateAndOpenSkin = async (): Promise<string | null> => {
    console.log('[SkinStation] Opening file dialog...');
    let selected: string | string[] | null;
    try {
      selected = await open({ multiple: false, filters: [{ name: 'Skin Image', extensions: ['png'] }] });
    } catch (dialogErr) {
      console.error('[SkinStation] Dialog error:', dialogErr);
      addToast({ type: 'error', title: t('skinStation.invalidSkin'), message: t('skinStation.dialogFailed') });
      return null;
    }
    console.log('[SkinStation] Selected:', selected);

    if (!selected || typeof selected !== 'string') {
      if (Array.isArray(selected)) selected = selected[0];
      if (!selected || typeof selected !== 'string') return null;
    }

    console.log('[SkinStation] Validating skin file:', selected);
    try {
      const result = await api.validateSkinFile(selected);
      console.log('[SkinStation] Validation result:', result);
    } catch (e: unknown) {
      const errMsg = formatError(e);
      console.error('[SkinStation] Validation failed:', e, errMsg);
      addToast({ type: 'error', title: t('skinStation.invalidSkin'), message: errMsg });
      return null;
    }
    return selected;
  };

  const handleUploadSkin = async () => {
    if (!yggdrasilAccount) return;
    const selected = await validateAndOpenSkin();
    if (!selected) return;
    try {
      setUploading(true);
      console.log('[SkinStation] Uploading skin for Yggdrasil account:', yggdrasilAccount.username);
      await api.yggdrasilUploadSkin(
        yggdrasilAccount.uuid,
        yggdrasilAccount.yggdrasil_server_url!,
        yggdrasilAccount.access_token,
        selected,
        skinModel,
      );
      addToast({ type: 'success', title: t('skinStation.uploadSuccess') });
      await refreshAccounts();
      fetchYggdrasilProfile();
    } catch (e: unknown) {
      console.error('[SkinStation] Upload failed:', e);
      addToast({ type: 'error', title: t('skinStation.uploadFailed'), message: formatError(e) });
    } finally {
      setUploading(false);
    }
  };

  const handleResetSkin = async () => {
    if (!yggdrasilAccount) return;
    try {
      await api.yggdrasilResetSkin(
        yggdrasilAccount.uuid,
        yggdrasilAccount.yggdrasil_server_url!,
        yggdrasilAccount.access_token,
      );
      addToast({ type: 'success', title: t('skinStation.resetSuccess') });
      fetchYggdrasilProfile();
    } catch (e: unknown) {
      console.error('[SkinStation] Reset failed:', e);
      addToast({ type: 'error', title: t('skinStation.resetFailed'), message: formatError(e) });
    }
  };

  const handleMicrosoftUploadSkin = async () => {
    if (!microsoftAccount) return;
    const selected = await validateAndOpenSkin();
    if (!selected) return;
    try {
      setUploading(true);
      const variant = skinModel === 'slim' ? 'SLIM' : 'CLASSIC';
      console.log(
        '[SkinStation] Uploading skin for Microsoft account:',
        microsoftAccount.username,
        'variant:',
        variant,
      );
      await api.microsoftUploadSkin(microsoftAccount.access_token, selected, variant);
      addToast({ type: 'success', title: t('skinStation.uploadSuccess') });
      await refreshAccounts();
      fetchMicrosoftProfile();
    } catch (e: unknown) {
      console.error('[SkinStation] Microsoft upload failed:', e);
      addToast({ type: 'error', title: t('skinStation.uploadFailed'), message: formatError(e) });
    } finally {
      setUploading(false);
    }
  };

  const handleMicrosoftDeleteSkin = async (skinId: string) => {
    if (!microsoftAccount) return;
    try {
      await api.microsoftDeleteSkin(microsoftAccount.access_token, skinId);
      addToast({ type: 'success', title: t('skinStation.deleteSkinSuccess') });
      fetchMicrosoftProfile();
    } catch (e: unknown) {
      console.error('[SkinStation] Delete skin failed:', e);
      addToast({ type: 'error', title: t('skinStation.deleteSkinFailed'), message: formatError(e) });
    }
  };

  const handleSelectLocalSkin = async () => {
    if (!activeAccount) {
      console.warn('[SkinStation] No active account, cannot set local skin');
      addToast({ type: 'warning', title: t('skinStation.noAccount'), message: t('skinStation.noAccountDesc') });
      return;
    }
    const selected = await validateAndOpenSkin();
    if (!selected) return;
    try {
      console.log(
        '[SkinStation] Setting local skin for account:',
        activeAccount.id,
        'path:',
        selected,
        'model:',
        skinModel,
      );
      await api.setLocalSkin(activeAccount.id, selected, skinModel);
    } catch (e: unknown) {
      console.error('[SkinStation] setLocalSkin failed:', e);
      addToast({ type: 'error', title: t('skinStation.setFailed'), message: formatError(e) });
      return;
    }
    addToast({ type: 'success', title: t('skinStation.localSkinSet') });
    try {
      await refreshAccounts();
    } catch {
      /* empty */
    }
    try {
      const b64 = await api.readSkinFile(selected);
      setLocalSkinUrl(`data:image/png;base64,${b64}`);
    } catch (readErr) {
      console.error('[SkinStation] readSkinFile failed after setLocalSkin:', readErr);
      setLocalSkinUrl(null);
    }
  };

  const handleClearLocalSkin = async () => {
    if (!activeAccount) return;
    try {
      await api.setLocalSkin(activeAccount.id, null, null);
      setLocalSkinUrl(null);
      addToast({ type: 'success', title: t('skinStation.localSkinCleared') });
      await refreshAccounts();
    } catch (e: unknown) {
      console.error('[SkinStation] Clear local skin failed:', e);
      addToast({ type: 'error', title: t('skinStation.clearFailed'), message: formatError(e) });
    }
  };

  const handleEnsureAuthlib = async () => {
    setAuthlibStatus('downloading');
    try {
      await api.ensureAuthlibInjector();
      setAuthlibStatus('ready');
      addToast({ type: 'success', title: t('skinStation.authlibReadyToast') });
    } catch (e: unknown) {
      console.error('[SkinStation] Download authlib-injector failed:', e);
      setAuthlibStatus('idle');
      addToast({ type: 'error', title: t('skinStation.downloadFailed'), message: formatError(e) });
    }
  };

  const previewSkinUrl = localSkinUrl || skinUrl;
  const isOfflineAccount = activeAccount?.account_type === 'offline';
  const isMicrosoftAccount = activeAccount?.account_type === 'microsoft';

  const authlibRow = (
    <div className={styles.skinAuthlibRow}>
      <StatusDot status={authlibStatus === 'ready' ? 'ready' : 'inactive'} />
      <span className={styles.skinAuthlibLabel}>
        authlib-injector:{' '}
        {authlibStatus === 'ready'
          ? t('skinStation.authlibReady')
          : authlibStatus === 'downloading'
            ? t('skinStation.authlibDownloading')
            : t('skinStation.authlibNotDownloaded')}
      </span>
      {authlibStatus !== 'ready' && (
        <Button variant="secondary" size="sm" onClick={handleEnsureAuthlib} disabled={authlibStatus === 'downloading'}>
          {t('skinStation.download')}
        </Button>
      )}
    </div>
  );

  const modelToggle = (
    <SettingRow label={t('skinStation.skinModel')}>
      <div className={styles.skinModelToggle}>
        <Button
          variant={skinModel === 'default' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setSkinModel('default')}
        >
          {t('skinStation.classic')}
        </Button>
        <Button variant={skinModel === 'slim' ? 'primary' : 'secondary'} size="sm" onClick={() => setSkinModel('slim')}>
          {t('skinStation.slim')}
        </Button>
      </div>
    </SettingRow>
  );

  return (
    <SectionCard id="sec-skin-station" title={t('skinStation.title')}>
      <div className={styles.skinLayout}>
        <div className={styles.skinPreview}>
          <SkinViewer3D
            skinUrl={previewSkinUrl}
            capeUrl={capeUrl}
            model={skinModel === 'slim' ? 'slim' : 'default'}
            width={140}
            height={210}
          />
          <div className={styles.skinPreview__label}>
            {previewSkinUrl ? t('skinStation.skinPreview') : t('skinStation.noSkin')}
          </div>
        </div>

        <div className={styles.skinControls}>
          {!yggdrasilAccount && !isMicrosoftAccount && (
            <div className={styles.skinLoginSection}>
              <div className={styles.skinSubTitle}>{t('skinStation.onlineLogin')}</div>
              <div className={styles.skinDesc}>{t('skinStation.desc')}</div>
              <SettingRow label={t('skinStation.server')}>
                <div className={styles.skinInputFlex}>
                  <Select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    options={presets.map(([name, url]) => ({ value: url, label: name }))}
                  />
                  {selectedPreset === '' && (
                    <div className={styles.skinInputGap}>
                      <div className={formStyles.fieldWrapper}>
                        <TextInput
                          value={customUrl}
                          onChange={(e) => {
                            setCustomUrl(e.target.value);
                            yggdrasilUrlField.setValue(e.target.value);
                          }}
                          onBlur={yggdrasilUrlField.onBlur}
                          placeholder="https://example.com/api/yggdrasil"
                        />
                        {yggdrasilUrlField.error && (
                          <div className={formStyles.errorText}>{yggdrasilUrlField.error}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </SettingRow>
              <SettingRow label={t('skinStation.email')}>
                <div className={styles.skinInputFlex}>
                  <TextInput
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </SettingRow>
              <SettingRow label={t('skinStation.password')}>
                <div className={styles.skinInputFlex}>
                  <TextInput
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLogin();
                    }}
                  />
                </div>
              </SettingRow>
              {loginError && <div className={styles.skinError}>{loginError}</div>}
              <div className={styles.actions}>
                <Button variant="primary" size="sm" disabled={loggingIn} onClick={handleLogin}>
                  {loggingIn ? t('skinStation.loggingIn') : t('skinStation.loginBtn')}
                </Button>
              </div>
            </div>
          )}

          {yggdrasilAccount && (
            <>
              <div className={styles.accountRow}>
                <StatusDot status="ready" />
                <span className={styles.accountName}>{yggdrasilAccount.username}</span>
                <Badge variant="accent">YGGDRASIL</Badge>
                {yggdrasilAccount.yggdrasil_server_url && (
                  <span className={styles.skinServerUrl}>
                    {yggdrasilAccount.yggdrasil_server_url.replace(/https?:\/\//, '').replace(/\/api\/yggdrasil.*/, '')}
                  </span>
                )}
              </div>
              {yggdrasilAccount.yggdrasil_selected_profile && (
                <SettingRow label={t('skinStation.currentProfile')}>
                  <span className={styles.skinProfileId}>{yggdrasilAccount.yggdrasil_selected_profile}</span>
                </SettingRow>
              )}
              {modelToggle}
              <div className={styles.actions}>
                <Button variant="primary" size="sm" disabled={uploading} onClick={handleUploadSkin}>
                  {uploading ? t('skinStation.uploading') : t('skinStation.uploadSkin')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleResetSkin}>
                  {t('skinStation.resetSkin')}
                </Button>
              </div>
              {capeUrl && (
                <div className={styles.skinCapeHint}>
                  <span className={styles.skinCapeHint__dot} />
                  {t('skinStation.cape')}: {capeUrl.split('/').pop()}
                </div>
              )}
              {authlibRow}
            </>
          )}

          {isMicrosoftAccount && microsoftAccount && (
            <>
              <div className={styles.accountRow}>
                <StatusDot status="ready" />
                <span className={styles.accountName}>{microsoftAccount.username}</span>
                <Badge variant="accent">MICROSOFT</Badge>
              </div>
              {modelToggle}
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={uploading || msLoading}
                  onClick={handleMicrosoftUploadSkin}
                >
                  {uploading ? t('skinStation.uploading') : t('skinStation.uploadSkin')}
                </Button>
              </div>
              {msSkins.length > 0 && (
                <div className={`${styles.skinSubTitle} ${styles.skinSubTitleGap}`}>{t('skinStation.mySkins')}</div>
              )}
              {msSkins.map((skin: McSkinInfo) => (
                <div key={skin.id} className={styles.skinCapeHint}>
                  <span
                    className={styles.skinCapeHint__dot}
                    style={{ background: skin.state === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                  />
                  <span className={styles.skinVariantText}>
                    {skin.variant === 'SLIM' ? t('skinStation.slim') : t('skinStation.classic')}
                    {skin.state === 'ACTIVE' ? ` (${t('skinStation.active')})` : ''}
                  </span>
                  {skin.state !== 'ACTIVE' && (
                    <Button variant="secondary" size="sm" onClick={() => handleMicrosoftDeleteSkin(skin.id)}>
                      {t('skinStation.deleteSkin')}
                    </Button>
                  )}
                </div>
              ))}
              {msCapeAlias && (
                <div className={`${styles.skinCapeHint} ${styles.skinCapeHintGap}`}>
                  <span className={styles.skinCapeHint__dot} />
                  {t('skinStation.cape')}: {msCapeAlias}
                </div>
              )}
              <hr className={styles.skinDivider} />
              <div className={styles.skinSubTitle}>{t('skinStation.localSkin')}</div>
              <div className={styles.skinDesc}>{t('skinStation.localSkinMsDesc')}</div>
              <div className={styles.actions}>
                <Button variant="secondary" size="sm" onClick={handleSelectLocalSkin}>
                  {t('skinStation.selectLocalSkin')}
                </Button>
                {activeAccount?.local_skin_path && (
                  <Button variant="secondary" size="sm" onClick={handleClearLocalSkin}>
                    {t('skinStation.clearSkin')}
                  </Button>
                )}
              </div>
              {activeAccount?.local_skin_path && (
                <div className={styles.skinFileHint}>
                  <span className={styles.skinFileHint__icon}>&#9670;</span>
                  {activeAccount.local_skin_path.split(/[/\\]/).pop()}
                </div>
              )}
              {authlibRow}
            </>
          )}

          {isOfflineAccount && (
            <>
              <div className={styles.accountRow}>
                <StatusDot status="ready" />
                <span className={styles.accountName}>{activeAccount?.username}</span>
                <Badge variant="accent">OFFLINE</Badge>
              </div>
              <div className={styles.skinSubTitle}>{t('skinStation.localSkin')}</div>
              <div className={styles.skinDesc}>{t('skinStation.localSkinOfflineDesc')}</div>
              {modelToggle}
              <div className={styles.actions}>
                <Button variant="primary" size="sm" onClick={handleSelectLocalSkin}>
                  {t('skinStation.selectLocalSkin')}
                </Button>
                {activeAccount?.local_skin_path && (
                  <Button variant="secondary" size="sm" onClick={handleClearLocalSkin}>
                    {t('skinStation.clearSkin')}
                  </Button>
                )}
              </div>
              {activeAccount?.local_skin_path && (
                <div className={styles.skinFileHint}>
                  <span className={styles.skinFileHint__icon}>&#9670;</span>
                  {activeAccount.local_skin_path.split(/[/\\]/).pop()}
                </div>
              )}
              {authlibRow}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
