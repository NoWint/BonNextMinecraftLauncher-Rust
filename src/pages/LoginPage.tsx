import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatError } from '../utils/errorMapping';
import { api, type DeviceCodeResponse } from '../api';
import { useAuth } from '../stores/authStore';
import { useI18n } from '../i18n';
import { SubLabel } from '../components/layout';
import { StatusDot, ProgressBar, Button, TextInput, Select } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { useGreeting, getRandomLoadingMessage } from '../hooks/useGreeting';
import { useConfetti } from '../hooks/useConfetti';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { state, offlineLogin, yggdrasilLogin } = useAuth();
  const { t } = useI18n();
  const greeting = useGreeting(t);
  const fireConfetti = useConfetti();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeInput, setShakeInput] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [msError, setMsError] = useState('');
  const [dots, setDots] = useState(0);
  const [guestLoading, setGuestLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [showYggForm, setShowYggForm] = useState(false);
  const [yggPresets, setYggPresets] = useState<[string, string][]>([]);
  const [yggServer, setYggServer] = useState('https://littleskin.cn/api/yggdrasil');
  const [yggCustomUrl, setYggCustomUrl] = useState('');
  const [yggEmail, setYggEmail] = useState('');
  const [yggPassword, setYggPassword] = useState('');
  const [yggLoading, setYggLoading] = useState(false);
  const [yggError, setYggError] = useState('');

  const yggServerUrl = yggServer === '' ? yggCustomUrl : yggServer;

  // Auto-focus input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    api.getYggdrasilPresets().then(setYggPresets).catch(() => {});
  }, []);

  // Animated dots while loading
  useEffect(() => {
    if (!loading && !msLoading) return;
    const timer = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(timer);
  }, [loading, msLoading]);

  const handleOfflineLogin = async () => {
    if (!username.trim()) {
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 500);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await offlineLogin(username.trim());
      fireConfetti();
      navigate('/home');
    } catch (e: unknown) {
      setError(formatError(e) || t('login.error.default'));
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setMsLoading(true);
    setMsError('');
    try {
      const code = await api.startMicrosoftAuth();
      setDeviceCode(code);
    } catch (e: unknown) {
      setMsError(formatError(e) || 'Failed to start Microsoft login');
      setMsLoading(false);
    }
  };

  useEffect(() => {
    if (!deviceCode) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api.pollMicrosoftAuth(deviceCode.device_code);
        if (!cancelled) {
          await api.setActiveAccount(result.uuid);
          fireConfetti();
          window.location.reload();
        }
      } catch (e: unknown) {
        const msg = formatError(e);
        if (
          msg.includes('timed out') ||
          msg.includes('expired') ||
          msg.includes('denied') ||
          msg.includes('cancelled')
        ) {
          if (!cancelled) {
            setMsError(msg);
            setMsLoading(false);
            setDeviceCode(null);
          }
          return;
        }
        if (!cancelled) setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [deviceCode]);

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setError('');
    try {
      await api.createGuestInstance();
      await offlineLogin('Guest_' + Math.random().toString(36).slice(2, 8));
      fireConfetti();
      navigate('/home');
    } catch (e: unknown) {
      setError(formatError(e) || t('login.error.default'));
    } finally {
      setGuestLoading(false);
    }
  };

  const handleYggdrasilLogin = async () => {
    if (!yggServerUrl || !yggEmail || !yggPassword) {
      setYggError(t('skinStation.fillAllFields'));
      return;
    }
    setYggLoading(true);
    setYggError('');
    try {
      await yggdrasilLogin(yggServerUrl, yggEmail, yggPassword);
      fireConfetti();
      navigate('/home');
    } catch (e: unknown) {
      const raw = formatError(e);
      let msg = raw;
      if (raw.includes('ForbiddenOperationException') || raw.includes('邮箱或密码错误')) {
        msg = t('skinStation.errorWrongPassword');
      } else if (raw.includes('RateLimitedException') || raw.includes('频繁')) {
        msg = t('skinStation.errorRateLimited');
      } else if (raw.includes('ResourceNotFoundException') || raw.includes('未找到')) {
        msg = t('skinStation.errorServerNotFound');
      } else if (raw.includes('No game profile') || raw.includes('No game profile')) {
        msg = t('skinStation.errorNoProfile');
      } else if (raw.includes('连接') || raw.includes('timeout') || raw.includes('network')) {
        msg = t('skinStation.errorNetwork');
      }
      setYggError(msg || t('skinStation.loginFailed'));
    } finally {
      setYggLoading(false);
    }
  };

  const busy = state.loading || loading || msLoading || guestLoading;
  const loadingMsg = getRandomLoadingMessage(t);

  return (
    <div className={styles.page}>
      <div className={styles.decorTopRight} />
      <div className={styles.decorBottomLeft} />

      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logoRow}>
          <div className={`${styles.logoHex} ${busy ? '' : 'breathe-strong'}`} />
          <span className={styles.logoText}>BONNEXT</span>
          <span className={styles.logoVersion}>{t('app.version')}</span>
        </div>

        {/* Time-based greeting */}
        <div
          style={{
            fontSize: '0.5em',
            color: '#666',
            letterSpacing: 5,
            marginBottom: 8,
          }}
        >
          <Icon name={greeting.icon} size={20} /> {greeting.subtitle}
        </div>

        <div className={styles.tagline}>{t('login.title')}</div>

        {/* Microsoft login */}
        <div className={styles.msSection}>
          {!deviceCode ? (
            <>
              <Button
                variant="primary"
                size="lg"
                disabled={msLoading}
                onClick={handleMicrosoftLogin}
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.9em', padding: '14px 48px' }}
              >
                {msLoading ? `${loadingMsg}${'.'.repeat(dots)}` : '\u{1F511} ' + t('login.microsoft')}
              </Button>
              {msError && (
                <div className={styles.msError} style={{ animation: 'shake-x 0.5s var(--ease-out-expo)' }}>
                  {msError}
                </div>
              )}
            </>
          ) : (
            <div className={styles.deviceCodeBox}>
              <SubLabel>{t('login.verification')}</SubLabel>
              <div
                className={styles.deviceCodeValue}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.1em',
                  letterSpacing: 4,
                  animation: 'breathe-subtle 2s ease-in-out infinite',
                }}
              >
                {deviceCode.user_code}
              </div>
              <div className={styles.deviceCodeMsg}>{deviceCode.message}</div>
              <div className={styles.deviceCodeHint}>
                {t('login.verificationHint', { url: deviceCode.verification_uri })}
              </div>
              <div className={styles.deviceCodeProgress}>
                <ProgressBar progress={50} showLabel={false} />
              </div>
              <div className={styles.deviceCodeCancel}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDeviceCode(null);
                    setMsLoading(false);
                    setMsError('');
                  }}
                >
                  {t('login.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>{t('login.divider')}</span>
          <div className={styles.dividerLine} />
        </div>

        {/* Offline login */}
        <div className={styles.offlineSection}>
          <div className={`${styles.offlineRow} ${shakeInput ? 'shake' : ''}`}>
            <div className={styles.offlineInput}>
              <TextInput
                placeholder={t('login.usernamePlaceholder')}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleOfflineLogin()}
              />
            </div>
            <Button
              variant="secondary-highlight"
              size="md"
              disabled={busy || !username.trim()}
              onClick={handleOfflineLogin}
              style={{ fontSize: '0.65em', padding: '10px 20px' }}
            >
              {loading ? `${loadingMsg}${'.'.repeat(dots)}` : t('login.offline')}
            </Button>
          </div>
          {error && (
            <div className={styles.offlineError} style={{ animation: 'shake-x 0.5s var(--ease-out-expo)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Guest mode */}
        <div className={styles.guestSection}>
          <div className={styles.guestLabel}>{t('login.guestDesc')}</div>
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={handleGuestLogin}
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.65em', padding: '8px 20px' }}
          >
            {guestLoading ? (
              `${loadingMsg}${'.'.repeat(dots)}`
            ) : (
              <>
                {' '}
                <Icon name="user" size={14} /> {t('login.guest')}
              </>
            )}
          </Button>
        </div>

        {/* Yggdrasil / Skin Station login */}
        <div className={styles.yggSection}>
          <span className={styles.yggToggle} onClick={() => setShowYggForm(!showYggForm)}>
            <Icon name="globe" size={12} />{' '}
            {showYggForm ? t('login.yggHide') : t('login.yggShow')}
          </span>
          {showYggForm && (
            <div className={styles.yggForm}>
              <div className={styles.yggFormRow}>
                <Select
                  value={yggServer}
                  onChange={(e) => setYggServer(e.target.value)}
                  options={yggPresets.map(([name, url]) => ({ value: url, label: name }))}
                  className={styles.yggServerSelect}
                />
              </div>
              {yggServer === '' && (
                <div className={styles.yggFormRow}>
                  <div className={styles.yggFormInput}>
                    <TextInput
                      value={yggCustomUrl}
                      onChange={(e) => setYggCustomUrl(e.target.value)}
                      placeholder="https://example.com/api/yggdrasil"
                    />
                  </div>
                </div>
              )}
              <div className={styles.yggFormRow}>
                <div className={styles.yggFormInput}>
                  <TextInput
                    type="email"
                    value={yggEmail}
                    onChange={(e) => { setYggEmail(e.target.value); setYggError(''); }}
                    placeholder={t('skinStation.email')}
                  />
                </div>
              </div>
              <div className={styles.yggFormRow}>
                <div className={styles.yggFormInput}>
                  <TextInput
                    type="password"
                    value={yggPassword}
                    onChange={(e) => { setYggPassword(e.target.value); setYggError(''); }}
                    placeholder={t('skinStation.password')}
                    onKeyDown={(e) => e.key === 'Enter' && handleYggdrasilLogin()}
                  />
                </div>
              </div>
              {yggError && <div className={styles.yggError}>{yggError}</div>}
              <div className={styles.yggFormActions}>
                <Button
                  variant="secondary-highlight"
                  size="sm"
                  disabled={yggLoading || !yggEmail || !yggPassword}
                  onClick={handleYggdrasilLogin}
                >
                  {yggLoading ? `${loadingMsg}${'.'.repeat(dots)}` : t('skinStation.loginBtn')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className={styles.statusRow}>
          <StatusDot status={busy ? 'processing' : 'inactive'} />
          <span className={styles.statusText}>
            {t('login.signal')} ·{' '}
            {loading
              ? t('login.status.authing')
              : msLoading
                ? t('login.status.waiting')
                : guestLoading
                  ? t('login.status.authing')
                  : t('login.status.awaiting')}
          </span>
        </div>
      </div>
    </div>
  );
}
