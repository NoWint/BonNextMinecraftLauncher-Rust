import {
  motion,
  useScroll,
  useTransform,
  useVelocity,
  useSpring,
  useReducedMotion,
} from 'framer-motion';
import { useEffect, useRef } from 'react';
import styles from './Hero.module.css';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const ctaPrimaryRef = useRef<HTMLAnchorElement>(null);
  const ctaSecondaryRef = useRef<HTMLAnchorElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Existing scroll-driven parallax + fade
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.15, 1]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // 3D 透视倾斜 — content container tilts in 3D on scroll
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 15]);

  // 滚动速度模糊 — headline blurs based on scroll velocity
  const velocity = useVelocity(scrollYProgress);
  const blurRaw = useTransform(velocity, [-0.5, 0, 0.5], [8, 0, 8]);
  const blurSpring = useSpring(blurRaw, { stiffness: 200, damping: 30 });
  const headlineFilter = useTransform(
    blurSpring,
    (b) => `blur(${b.toFixed(2)}px)`
  );

  // 磁吸光标 — CTA buttons follow cursor slightly
  useEffect(() => {
    if (prefersReducedMotion) return;

    const buttons = [ctaPrimaryRef.current, ctaSecondaryRef.current].filter(
      Boolean
    ) as HTMLAnchorElement[];
    if (buttons.length === 0) return;

    const STRENGTH = 0.3;
    const tracked: Array<{
      el: HTMLAnchorElement;
      move: (e: MouseEvent) => void;
      leave: () => void;
    }> = [];

    buttons.forEach((el) => {
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
      tracked.push({ el, move, leave });
    });

    return () => {
      tracked.forEach(({ el, move, leave }) => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      });
    };
  }, [prefersReducedMotion]);

  return (
    <section id="hero" ref={ref} className={styles.hero}>
      <motion.div
        className={styles.bg}
        style={{ scale: bgScale, opacity: bgOpacity }}
        aria-hidden="true"
      />
      <motion.div
        className={styles.content}
        style={{
          y: textY,
          opacity: textOpacity,
          transformPerspective: prefersReducedMotion ? undefined : 1000,
          rotateX: prefersReducedMotion ? 0 : rotateX,
        }}
      >
        <motion.h1
          className={styles.headline}
          style={prefersReducedMotion ? undefined : { filter: headlineFilter }}
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
          <a
            ref={ctaPrimaryRef}
            href="#download"
            className={styles.ctaPrimary}
          >
            立即下载
          </a>
          <a
            ref={ctaSecondaryRef}
            href="#design"
            className={styles.ctaSecondary}
          >
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
