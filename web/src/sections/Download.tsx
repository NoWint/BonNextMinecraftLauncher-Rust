import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  useGitHubReleases,
  detectUserPlatform,
  type Platform,
} from '../hooks/useGitHubReleases';
import styles from './Download.module.css';

const REPO_OWNER = 'BonNext';
const REPO_NAME = 'BonNext';

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

const TITLE_WORDS = 'Enter the block world.'.split(' ');

export function Download() {
  const sectionRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const versionRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const inView = useInView(versionRef, { once: true, amount: 0.5 });
  const { release, loading, error } = useGitHubReleases(REPO_OWNER, REPO_NAME);

  const [userPlatform, setUserPlatform] = useState<Platform | null>(null);
  const [typedVersion, setTypedVersion] = useState('');

  // Platform auto-detection on mount
  useEffect(() => {
    setUserPlatform(detectUserPlatform());
  }, []);

  // 5. Version typewriter — characters appear one by one, terminal-style
  useEffect(() => {
    if (!release?.version || !inView) return;
    const version = release.version;

    if (prefersReduced) {
      setTypedVersion(version);
      return;
    }

    setTypedVersion('');
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      if (i < version.length) {
        i++;
        setTypedVersion(version.slice(0, i));
        timer = setTimeout(typeNext, 80);
      }
    };

    timer = setTimeout(typeNext, 200);

    return () => clearTimeout(timer);
  }, [release?.version, inView, prefersReduced]);

  // 1. Magnetic cursor — primary CTA follows cursor at 0.3 strength, springs back on leave
  useEffect(() => {
    if (prefersReduced) return;
    const el = ctaRef.current;
    if (!el) return;

    const STRENGTH = 0.3;
    const move = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${x * STRENGTH}px, ${y * STRENGTH}px)`;
    };
    const leave = () => {
      el.style.transform = 'translate(0px, 0px)';
    };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [prefersReduced, loading, error]);

  // Resolve primary download asset for detected platform
  const primaryAsset =
    userPlatform && release ? release.assets[userPlatform][0] : null;
  const primaryHref =
    primaryAsset?.url ??
    `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

  const ctaLabel = loading
    ? '加载中…'
    : error
      ? '前往 GitHub'
      : userPlatform
        ? `下载 for ${PLATFORM_LABELS[userPlatform]}`
        : '下载 BonNext';

  return (
    <section id="download" ref={sectionRef} className={styles.section}>
      {/* 2. Breathing glow — radial gradient 4s cycle, scale 1→1.1, opacity 0.6→1 */}
      <motion.div
        className={styles.glow}
        aria-hidden="true"
        animate={
          prefersReduced
            ? undefined
            : {
                scale: [1, 1.1, 1],
                opacity: [0.6, 1, 0.6],
              }
        }
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <div className="container">
        <div className={styles.content}>
          {/* 4. Platform detection pulse — badge with pulsing dot guides attention */}
          {userPlatform && (
            <motion.div
              className={styles.platformBadge}
              initial={prefersReduced ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className={styles.platformDot} />
              <span className={styles.platformText}>
                检测到 {PLATFORM_LABELS[userPlatform]} 平台
              </span>
            </motion.div>
          )}

          {/* 3. Title word-by-word reveal — each word delays 0.08s incrementally */}
          <h2 className={styles.title}>
            {TITLE_WORDS.map((word, i) => (
              <motion.span
                key={i}
                className={styles.titleWord}
                initial={
                  prefersReduced
                    ? false
                    : { opacity: 0, y: 30, filter: 'blur(8px)' }
                }
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * 0.08,
                }}
              >
                {word}{' '}
              </motion.span>
            ))}
          </h2>

          <motion.p
            className={styles.desc}
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.4,
            }}
          >
            下载 BonNext，体验次世代 Minecraft 启动器。
          </motion.p>

          {/* 5. Version typewriter — terminal output feel */}
          <motion.div
            ref={versionRef}
            className={styles.versionLine}
            initial={prefersReduced ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <span className={styles.versionPrefix}>$ bonnext --version</span>
            <span className={styles.versionValue}>
              {loading ? 'loading…' : error ? 'unknown' : typedVersion}
              {!loading && !error && release && (
                <span className={styles.cursor}>▊</span>
              )}
            </span>
          </motion.div>

          {/* 1. Magnetic cursor CTA */}
          <motion.div
            className={styles.ctas}
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.8,
            }}
          >
            <a
              ref={ctaRef}
              href={primaryHref}
              className={styles.ctaPrimary}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.ctaLabel}>{ctaLabel}</span>
              {!loading && !error && primaryAsset && (
                <span className={styles.ctaMeta}>
                  {formatSize(primaryAsset.size)}
                </span>
              )}
            </a>
          </motion.div>

          {/* Alternative platform links */}
          {!error && release && (
            <motion.div
              className={styles.alternates}
              initial={prefersReduced ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              <span className={styles.alternatesLabel}>其他平台</span>
              <div className={styles.alternatesList}>
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => {
                  const asset = release.assets[p][0];
                  if (!asset) return null;
                  const isCurrent = p === userPlatform;
                  return (
                    <a
                      key={p}
                      href={asset.url}
                      className={`${styles.altLink} ${isCurrent ? styles.altLinkActive : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {PLATFORM_LABELS[p]}
                      <span className={styles.altSize}>
                        {formatSize(asset.size)}
                      </span>
                    </a>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Error fallback — direct link to GitHub Releases */}
          {error && (
            <motion.p
              className={styles.fallback}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              无法加载版本信息，请直接访问{' '}
              <a
                href={`https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.fallbackLink}
              >
                GitHub Releases
              </a>
              。
            </motion.p>
          )}
        </div>
      </div>
    </section>
  );
}
