import { useState, useEffect, useRef } from 'react';
import { api, type DeviceCodeResponse } from '../api';
import { useAuth } from '../stores/authStore';
import { SubLabel } from '../components/layout';
import { StatusDot, ProgressBar, Button, TextInput } from '../components/ui';
import { useGreeting, getRandomLoadingMessage } from '../hooks/useGreeting';
import { useConfetti } from '../hooks/useConfetti';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { state, offlineLogin } = useAuth();
  const greeting = useGreeting();
  const fireConfetti = useConfetti();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeInput, setShakeInput] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [msError, setMsError] = useState('');
  const [dots, setDots] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
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
    } catch (e: any) {
      setError(e?.toString() || '呜哇，登录失败了，再试一次？');
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
    } catch (e: any) {
      setMsError(e?.toString() || 'Failed to start Microsoft login');
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
      } catch (e: any) {
        const msg = e?.toString() || '';
        if (msg.includes('timed out') || msg.includes('expired') || msg.includes('denied') || msg.includes('cancelled')) {
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
    return () => { cancelled = true; };
  }, [deviceCode]);

  const busy = state.loading || loading || msLoading;
  const loadingMsg = getRandomLoadingMessage();

  return (
    <div className={styles.page}>
      <div className={styles.decorTopRight} />
      <div className={styles.decorBottomLeft} />

      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logoRow}>
          <div className={`${styles.logoHex} ${busy ? '' : 'breathe-strong'}`} />
          <span className={styles.logoText}>BONNEXT</span>
          <span className={styles.logoVersion}>v0.2</span>
        </div>

        {/* Time-based greeting */}
        <div style={{
          fontSize: '0.5em', color: '#666',
          letterSpacing: 5, marginBottom: 8,
        }}>
          {greeting.emoji} {greeting.subtitle}
        </div>

        <div className={styles.tagline}>MINECRAFT LAUNCHER · NEO-TOKYO EDITION</div>

        {/* Microsoft login */}
        <div className={styles.msSection}>
          {!deviceCode ? (
            <>
              <Button
                variant="primary" size="lg"
                disabled={msLoading}
                onClick={handleMicrosoftLogin}
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.9em', padding: '14px 48px' }}
              >
                {msLoading ? `${loadingMsg}${'.'.repeat(dots)}` : '🔑 MICROSOFT 登录'}
              </Button>
              {msError && (
                <div className={styles.msError} style={{ animation: 'shake-x 0.5s var(--ease-out-expo)' }}>
                  {msError}
                </div>
              )}
            </>
          ) : (
            <div className={styles.deviceCodeBox}>
              <SubLabel>MICROSOFT VERIFICATION</SubLabel>
              <div className={styles.deviceCodeValue} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1em',
                letterSpacing: 4,
                animation: 'breathe-subtle 2s ease-in-out infinite',
              }}>
                {deviceCode.user_code}
              </div>
              <div className={styles.deviceCodeMsg}>{deviceCode.message}</div>
              <div className={styles.deviceCodeHint}>
                打开 <span className={styles.deviceCodeHintAccent}>{deviceCode.verification_uri}</span>{' '}
                并输入上方代码
              </div>
              <div className={styles.deviceCodeProgress}>
                <ProgressBar progress={50} showLabel={false} />
              </div>
              <div className={styles.deviceCodeCancel}>
                <Button
                  variant="secondary" size="sm"
                  onClick={() => { setDeviceCode(null); setMsLoading(false); setMsError(''); }}
                >
                  CANCEL
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>或</span>
          <div className={styles.dividerLine} />
        </div>

        {/* Offline login */}
        <div className={styles.offlineSection}>
          <div className={`${styles.offlineRow} ${shakeInput ? 'shake' : ''}`}>
            <div className={styles.offlineInput}>
              <TextInput
                placeholder="玩家名称"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleOfflineLogin()}
              />
            </div>
            <Button
              variant="secondary-highlight" size="md"
              disabled={busy || !username.trim()}
              onClick={handleOfflineLogin}
              style={{ fontSize: '0.65em', padding: '10px 20px' }}
            >
              {loading ? `${loadingMsg}${'.'.repeat(dots)}` : '离线启动'}
            </Button>
          </div>
          {error && (
            <div className={styles.offlineError} style={{ animation: 'shake-x 0.5s var(--ease-out-expo)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Status */}
        <div className={styles.statusRow}>
          <StatusDot status={busy ? 'processing' : 'inactive'} />
          <span className={styles.statusText}>
            SIGNAL · {loading ? 'AUTHENTICATING' : msLoading ? 'WAITING' : 'AWAITING AUTH'}
          </span>
        </div>
      </div>
    </div>
  );
}
