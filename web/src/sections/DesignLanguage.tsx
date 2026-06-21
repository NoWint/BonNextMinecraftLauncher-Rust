import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import styles from './DesignLanguage.module.css';

const PILLARS = [
  {
    id: 'yellow',
    label: 'Electric Yellow',
    title: 'One color. One meaning.',
    desc: '#FFE600 — the only accent in the entire system. It marks primary actions. It signals focus. When you see it, you know something matters.',
    bg: 'radial-gradient(circle at 50% 50%, rgba(255,230,0,0.15) 0%, #000 60%)',
  },
  {
    id: 'edges',
    label: 'Hard Edges',
    title: 'Uncompromising geometry.',
    desc: 'Cards are clipped at angles. Buttons land like switch panels. Every surface reads like a HUD overlay on a triple-A title.',
    bg: 'linear-gradient(135deg, #1D1D1F 0%, #000 100%)',
  },
  {
    id: 'dark',
    label: 'Born Dark',
    title: 'True black canvas.',
    desc: 'OLED native. Layers lift out of the void with depth and precision — like instrument panels on a night flight deck.',
    bg: '#000000',
  },
  {
    id: 'noise',
    label: 'Noise & Grain',
    title: 'Digital becomes tangible.',
    desc: 'A structured noise texture sits across the viewport. Scanlines hum at threshold visibility. The screen has material.',
    bg: 'radial-gradient(circle at 30% 70%, rgba(255,230,0,0.05) 0%, #000 70%)',
  },
  {
    id: 'motion',
    label: 'Motion that breathes',
    title: 'Every transition is authored.',
    desc: 'Nothing is generated. Everything responds with the weight and precision of a premium creative tool.',
    bg: 'linear-gradient(180deg, #000 0%, #1D1D1F 100%)',
  },
];

export function DesignLanguage() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  return (
    <section id="design" ref={ref} className={styles.section}>
      <div className={styles.sticky}>
        {PILLARS.map((pillar, i) => {
          const start = i / PILLARS.length;
          const end = (i + 1) / PILLARS.length;
          const scale = useTransform(scrollYProgress, [start, end], [1, 0.85]);
          const opacity = useTransform(scrollYProgress, [start, end - 0.05, end], [1, 1, 0]);
          const y = useTransform(scrollYProgress, [start, end], [0, -50]);

          return (
            <motion.div
              key={pillar.id}
              className={styles.card}
              style={{
                scale,
                opacity,
                y,
                background: pillar.bg,
                zIndex: i,
              }}
            >
              <div className={styles.cardContent}>
                <div className={styles.label}>{pillar.label}</div>
                <h2 className={styles.title}>{pillar.title}</h2>
                <p className={styles.desc}>{pillar.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
