import { motion, useScroll, useTransform } from 'framer-motion';
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
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  return (
    <section id="manifesto" ref={ref} className={styles.manifesto}>
      <div className="container-narrow">
        <p className={styles.text}>
          {LINES.map((line, i) => {
            const start = i / LINES.length;
            const end = start + 1 / LINES.length;
            const opacity = useTransform(scrollYProgress, [start, end], [0.15, 1]);
            return (
              <motion.span key={i} style={{ opacity }} className={styles.line}>
                {line}{' '}
              </motion.span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
