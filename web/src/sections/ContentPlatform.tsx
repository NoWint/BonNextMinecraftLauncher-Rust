import { motion, useScroll, useTransform, useInView, useReducedMotion } from 'framer-motion';
import { useRef, useEffect, useState, type MouseEvent } from 'react';
import styles from './ContentPlatform.module.css';

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1500;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

type Platform = {
  id: string;
  name: string;
  api: string;
  desc: string;
  statValue: number;
  statSuffix: string;
  statLabel: string;
  accent: string;
};

const PLATFORMS: Platform[] = [
  {
    id: 'modrinth',
    name: 'Modrinth',
    api: 'API v2',
    desc: '开源友好的模组平台，API v2 设计精良。搜索、项目详情、版本列表、文件下载。',
    statValue: 12000,
    statSuffix: '+',
    statLabel: 'projects',
    accent: '#1BD96A',
  },
  {
    id: 'curseforge',
    name: 'CurseForge',
    api: 'API v1',
    desc: '老牌模组平台，内容丰富。API v1 覆盖搜索、精选、模组文件与下载。',
    statValue: 80000,
    statSuffix: '+',
    statLabel: 'projects',
    accent: '#FFE600',
  },
];

function PlatformCard({
  platform,
  direction,
  prefersReduced,
}: {
  platform: Platform;
  direction: 'left' | 'right';
  prefersReduced: boolean | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateY: 0, rotateX: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReduced) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    // direction left → tilt toward right (positive Y), right → tilt toward left (negative Y)
    const baseY = direction === 'left' ? 8 : -8;
    const rotateY = (px - 0.5) * 2 * baseY;
    const rotateX = -(py - 0.5) * 2 * 6;
    setTilt({ rotateY, rotateX });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateY: 0, rotateX: 0 });
  };

  return (
    <motion.div
      ref={cardRef}
      className={styles.card}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={
        prefersReduced
          ? false
          : { clipPath: 'inset(0 100% 0 0)', opacity: 0 }
      }
      whileInView={{ clipPath: 'inset(0 0 0 0)', opacity: 1 }}
      viewport={{ once: true, margin: '-15% 0px -15% 0px' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{
        transformPerspective: 1000,
        rotateY: prefersReduced ? 0 : tilt.rotateY,
        rotateX: prefersReduced ? 0 : tilt.rotateX,
        transition: 'transform 0.2s ease-out',
      }}
    >
      <div className={styles.cardGlow} style={{ background: platform.accent }} aria-hidden="true" />
      <div className={styles.cardHeader}>
        <div className={styles.cardName}>{platform.name}</div>
        <div className={styles.cardApi} style={{ color: platform.accent }}>
          {platform.api}
        </div>
      </div>
      <p className={styles.cardDesc}>{platform.desc}</p>
      <div className={styles.cardStat}>
        <div className={styles.statValue} style={{ color: platform.accent }}>
          <AnimatedNumber value={platform.statValue} suffix={platform.statSuffix} />
        </div>
        <div className={styles.statLabel}>{platform.statLabel}</div>
      </div>
      <div className={styles.cardEndpoints} aria-hidden="true">
        <span className={styles.endpoint}>search</span>
        <span className={styles.endpoint}>projects</span>
        <span className={styles.endpoint}>versions</span>
        <span className={styles.endpoint}>files</span>
      </div>
    </motion.div>
  );
}

export function ContentPlatform() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // 1. 水平滚动驱动：左卡 -50%→0，右卡 +50%→0
  const leftX = useTransform(scrollYProgress, [0, 0.5], ['-50%', '0%']);
  const rightX = useTransform(scrollYProgress, [0, 0.5], ['50%', '0%']);

  // 5. 背景视差：y -5%→5%
  const bgY = useTransform(scrollYProgress, [0, 1], ['-5%', '5%']);

  return (
    <section id="content" ref={ref} className={styles.section}>
      <motion.div
        className={styles.bg}
        style={{ y: prefersReduced ? 0 : bgY }}
        aria-hidden="true"
      />
      <div className="container">
        <div className={styles.label}>Content Platform</div>
        <motion.h2
          className={styles.title}
          initial={prefersReduced ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Two platforms. One interface.
        </motion.h2>
        <motion.p
          className={styles.desc}
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        >
          Modrinth API v2 与 CurseForge API v1 统一抽象。搜索、详情、版本、下载，一套接口全搞定。
        </motion.p>

        <div className={styles.grid}>
          <motion.div
            className={styles.cardWrap}
            style={{ x: prefersReduced ? 0 : leftX }}
          >
            <PlatformCard
              platform={PLATFORMS[0]}
              direction="left"
              prefersReduced={prefersReduced}
            />
          </motion.div>
          <motion.div
            className={styles.cardWrap}
            style={{ x: prefersReduced ? 0 : rightX }}
          >
            <PlatformCard
              platform={PLATFORMS[1]}
              direction="right"
              prefersReduced={prefersReduced}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
