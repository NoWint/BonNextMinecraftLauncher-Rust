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
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Faint yellow wash that breathes through the section as it scrolls into view.
  const tintOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

  // Emphasis scale for the "opened" keyword on the final line.
  const lastIndex = LINES.length - 1;
  const lastStart = lastIndex / LINES.length;
  const lastEnd = lastStart + 1 / LINES.length;
  const accentScale = useTransform(scrollYProgress, [lastStart, lastEnd], [0.94, 1.1]);

  return (
    <section id="manifesto" ref={ref} className={styles.manifesto}>
      <motion.div
        className={styles.tint}
        style={prefersReducedMotion ? undefined : { opacity: tintOpacity }}
        aria-hidden
      />
      <div className="container-narrow">
        <p className={styles.text}>
          {LINES.map((line, i) => {
            const start = i / LINES.length;
            const end = start + 1 / LINES.length;
            const opacity = useTransform(scrollYProgress, [start, end], [0.15, 1]);
            const y = useTransform(scrollYProgress, [start, end], [40, 0]);
            const blur = useTransform(scrollYProgress, [start, end], [8, 0]);
            const filter = useMotionTemplate`blur(${blur}px)`;

            const isLast = i === lastIndex;

            return (
              <motion.span
                key={i}
                className={styles.line}
                style={prefersReducedMotion ? { opacity } : { opacity, y, filter }}
              >
                {isLast ? (
                  <>
                    to be{' '}
                    <motion.span
                      className={styles.accent}
                      style={prefersReducedMotion ? undefined : { scale: accentScale }}
                    >
                      opened
                    </motion.span>
                    .
                  </>
                ) : (
                  line
                )}{' '}
              </motion.span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
