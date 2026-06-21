import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import styles from './CrossPlatform.module.css';

type Platform = 'windows' | 'macos' | 'linux';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'windows';
  if (ua.includes('Mac')) return 'macos';
  if (ua.includes('Linux')) return 'linux';
  return 'windows';
}

const PLATFORMS: { id: Platform; name: string; icon: string }[] = [
  { id: 'windows', name: 'Windows', icon: '⊞' },
  { id: 'macos', name: 'macOS', icon: '⌘' },
  { id: 'linux', name: 'Linux', icon: '🐧' },
];

export function CrossPlatform() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const [detected, setDetected] = useState<Platform | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  useEffect(() => {
    setDetected(detectPlatform());
  }, []);

  return (
    <section id="cross-platform" ref={ref} className={styles.section}>
      <motion.div
        className={styles.bg}
        style={{ y: prefersReduced ? 0 : bgY }}
        aria-hidden="true"
      />
      <div className={styles.container}>
        <motion.div
          className={styles.label}
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Cross-Platform
        </motion.div>
        <motion.h2
          className={styles.title}
          initial={prefersReduced ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          Windows. macOS. Linux.
        </motion.h2>
        <motion.p
          className={styles.desc}
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          跨平台支持，随时随地启动你的方块世界。
        </motion.p>
        <div className={styles.grid}>
          {PLATFORMS.map((platform, i) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              index={i}
              detected={detected === platform.id}
              prefersReduced={!!prefersReduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface PlatformCardProps {
  platform: { id: Platform; name: string; icon: string };
  index: number;
  detected: boolean;
  prefersReduced: boolean;
}

function PlatformCard({
  platform,
  index,
  detected,
  prefersReduced,
}: PlatformCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Motion values for magnetic hover tilt
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(my, { stiffness: 200, damping: 20 });
  const rotateY = useSpring(mx, { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (prefersReduced) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height; // 0..1
    // Map to -8..8 degrees; invert y so card tilts toward cursor
    mx.set((x - 0.5) * 16);
    my.set(-(y - 0.5) * 16);
  };

  const handleMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      className={styles.card}
      initial={prefersReduced ? false : { opacity: 0, y: 80 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.15 }}
      whileHover={
        prefersReduced ? undefined : { rotateY: 8, transformPerspective: 1000 }
      }
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className={styles.cardInner}
        style={{
          rotateX: prefersReduced ? 0 : rotateX,
          rotateY: prefersReduced ? 0 : rotateY,
          transformPerspective: 1000,
        }}
      >
        {detected && (
          <motion.div
            className={styles.detectedBadge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.span
              className={styles.detectedDot}
              animate={prefersReduced ? undefined : { opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            DETECTED
          </motion.div>
        )}
        <motion.div
          className={styles.icon}
          initial={prefersReduced ? false : { scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 15,
            delay: index * 0.15 + 0.7,
          }}
        >
          {platform.icon}
        </motion.div>
        <div className={styles.name}>{platform.name}</div>
      </motion.div>
    </motion.div>
  );
}
