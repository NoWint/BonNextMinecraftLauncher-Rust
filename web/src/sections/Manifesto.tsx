import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from 'framer-motion';
import { useRef } from 'react';
import styles from './Manifesto.module.css';

const LINES = [
  'Most launchers feel like',
  'they were built to pass',
  'a pull request review.',
  'BonNext was built',
  'to be opened.',
];

export function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Background tint breathes in and out across the section
  const tintOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

  return (
    <section id="manifesto" ref={ref} className={styles.manifesto}>
      <motion.div className={styles.tint} style={{ opacity: tintOpacity }} aria-hidden="true" />
      <div className="container-narrow">
        <p className={styles.text}>
          {LINES.map((line, i) => {
            const start = i / LINES.length;
            const end = start + 1 / LINES.length;
            const opacity = useTransform(scrollYProgress, [start, end], [0.15, 1]);
            const y = useTransform(scrollYProgress, [start, end], [40, 0]);
            const blurAmount = useTransform(scrollYProgress, [start, end], [8, 0]);
            const filter = useMotionTemplate`blur(${blurAmount}px)`;

            // Last line: emphasize "opened" with accent color + scale
            if (i === LINES.length - 1) {
              const accentScale = useTransform(scrollYProgress, [start, end], [0.94, 1.1]);
              return (
                <motion.span
                  key={i}
                  style={
                    prefersReduced
                      ? { opacity }
                      : { opacity, y, filter }
                  }
                  className={styles.line}
                >
                  {'to be '}
                  <motion.span
                    className={styles.accent}
                    style={prefersReduced ? undefined : { scale: accentScale }}
                  >
                    opened
                  </motion.span>
                  .{' '}
                </motion.span>
              );
            }

            return (
              <motion.span
                key={i}
                style={
                  prefersReduced
                    ? { opacity }
                    : { opacity, y, filter }
                }
                className={styles.line}
              >
                {line}{' '}
              </motion.span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
