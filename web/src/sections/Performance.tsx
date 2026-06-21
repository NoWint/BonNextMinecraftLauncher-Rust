import { motion, useScroll, useTransform, useInView, useReducedMotion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import styles from './Performance.module.css';

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
      {display}
      {suffix}
    </span>
  );
}

const STATS = [
  { value: 100, suffix: '+', label: 'Tauri 命令' },
  { value: 8, suffix: '', label: '并发下载' },
  { value: 3, suffix: '', label: '下载镜像' },
  { value: 2, suffix: '', label: '模组平台' },
];

export function Performance() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  return (
    <section id="performance" ref={ref} className={styles.section}>
      <motion.div
        className={styles.bg}
        style={{ y: prefersReduced ? 0 : bgY }}
        aria-hidden="true"
      />
      <div className="container">
        <div className={styles.label}>Performance</div>
        <h2 className={styles.title}>
          <motion.span
            className={styles.titleLine}
            initial={prefersReduced ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Rust core.
          </motion.span>
          <motion.span
            className={styles.titleLine}
            initial={prefersReduced ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            Parallel by nature.
          </motion.span>
        </h2>
        <p className={styles.desc}>
          Rust 原生性能，状态机驱动的启动流程。8 并发下载队列，智能限速与优先级调度。官方、BMCLAPI 三镜像自动故障转移。
        </p>
        <div className={styles.stats}>
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              className={styles.stat}
              initial={prefersReduced ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
            >
              <div className={styles.statValue}>
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className={styles.statLabel}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
        <motion.div
          className={styles.codeWindow}
          initial={prefersReduced ? false : { clipPath: 'inset(100% 0 0 0)', y: 60 }}
          whileInView={{ clipPath: 'inset(0 0 0 0)', y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.codeHeader}>
            <span className={styles.dot} style={{ background: '#FF5F57' }} />
            <span className={styles.dot} style={{ background: '#FEBC2E' }} />
            <span className={styles.dot} style={{ background: '#28C840' }} />
            <span className={styles.codeFile}>download/queue.rs</span>
          </div>
          <pre className={styles.code}>
            <code>
              <span className={styles.kw}>let</span> queue = {' '}
              <span className={styles.ty}>DownloadQueue</span>::new(){'\n'}
              {'  '}.<span className={styles.fn}>concurrency</span>(<span className={styles.num}>8</span>){'\n'}
              {'  '}.<span className={styles.fn}>mirror</span>(<span className={styles.ty}>Mirror</span>::AutoFailover){'\n'}
              {'  '}.<span className={styles.fn}>verify</span>(<span className={styles.ty}>Verify</span>::Sha1){'\n'}
              {'  '}.<span className={styles.fn}>build</span>();
            </code>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
