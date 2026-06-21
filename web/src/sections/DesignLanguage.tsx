import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
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
  const reduce = useReducedMotion();
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
          // 3D 透视倾斜：卡片切换时翻转
          const rotateX = useTransform(scrollYProgress, [start, end], [0, -8]);
          // 标签水平滑入：从左侧滑入并淡入
          const labelX = useTransform(scrollYProgress, [start, start + 0.08], [-30, 0]);
          const labelOpacity = useTransform(scrollYProgress, [start, start + 0.08], [0, 1]);
          // 背景位置偏移：渐变随滚动位移营造视差深度
          const bgX = useTransform(scrollYProgress, [start, end], [0, 30]);
          const bgY = useTransform(scrollYProgress, [start, end], [0, -20]);

          return (
            <motion.div
              key={pillar.id}
              className={styles.card}
              style={{
                scale: reduce ? 1 : scale,
                opacity,
                y: reduce ? 0 : y,
                rotateX: reduce ? 0 : rotateX,
                transformPerspective: 1200,
                zIndex: i,
              }}
            >
              <motion.div
                className={styles.cardBg}
                style={{
                  background: pillar.bg,
                  x: reduce ? 0 : bgX,
                  y: reduce ? 0 : bgY,
                }}
              />
              <div className={styles.cardContent}>
                <motion.div
                  className={styles.labelWrap}
                  style={{
                    x: reduce ? 0 : labelX,
                    opacity: reduce ? 1 : labelOpacity,
                  }}
                >
                  <div className={styles.label}>{pillar.label}</div>
                </motion.div>
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
