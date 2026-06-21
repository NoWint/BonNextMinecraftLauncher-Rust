import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import styles from './Hero.module.css';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const bgScale = useTransform(scrollYProgress, [0, 1], [1.15, 1]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section id="hero" ref={ref} className={styles.hero}>
      <motion.div
        className={styles.bg}
        style={{ scale: bgScale, opacity: bgOpacity }}
        aria-hidden="true"
      />
      <motion.div className={styles.content} style={{ y: textY, opacity: textOpacity }}>
        <motion.h1
          className={styles.headline}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        >
          Not a launcher.
          <br />
          An <span className={styles.accent}>entrance.</span>
        </motion.h1>
        <motion.p
          className={styles.subhead}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
        >
          不是启动器。是入口。
        </motion.p>
        <motion.div
          className={styles.ctas}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 1.1 }}
        >
          <a href="#download" className={styles.ctaPrimary}>
            立即下载
          </a>
          <a href="#design" className={styles.ctaSecondary}>
            了解更多
          </a>
        </motion.div>
      </motion.div>
      <motion.div
        className={styles.scrollHint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
        aria-hidden="true"
      >
        <span className={styles.scrollText}>向下滚动</span>
        <span className={styles.scrollLine} />
      </motion.div>
    </section>
  );
}
