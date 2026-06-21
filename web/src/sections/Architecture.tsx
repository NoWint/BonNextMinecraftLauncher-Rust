import { motion, useScroll, useTransform, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import styles from './Architecture.module.css';

const LAYERS = [
  {
    id: 'react',
    title: 'React 18 + TypeScript',
    desc: '前端 UI 层，CSS Modules，Framer Motion 动画',
    isCore: false,
  },
  {
    id: 'ipc',
    title: 'Tauri v2 IPC Bridge',
    desc: '100+ 命令桥接，事件系统，状态管理',
    isCore: false,
  },
  {
    id: 'rust',
    title: 'Rust Core',
    desc: '下载、版本、启动、模组、安全、实例管理',
    isCore: true,
  },
  {
    id: 'os',
    title: 'OS Platform',
    desc: 'Windows · macOS · Linux 跨平台原生支持',
    isCore: false,
  },
];

const STAGGER = 0.15;

export function Architecture() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // 5. 背景网格横向位移
  const gridX = useTransform(scrollYProgress, [0, 1], ['0px', '60px']);

  // 4. 核心层高亮检测
  const coreRef = useRef<HTMLDivElement>(null);
  const coreInView = useInView(coreRef, { once: true, amount: 0.5 });

  return (
    <section id="architecture" ref={ref} className={styles.section}>
      <motion.div
        className={styles.grid}
        style={{ x: prefersReduced ? 0 : gridX }}
        aria-hidden="true"
      />
      <div className={`container ${styles.content}`}>
        <motion.div
          className={styles.header}
          initial={prefersReduced ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.label}>Architecture</div>
          <h2 className={styles.title}>Tauri v2. 100+ commands.</h2>
          <p className={styles.desc}>
            Rust 后端 + React 前端，Tauri v2 桥接。性能与体验的完美平衡。
          </p>
        </motion.div>

        <div className={styles.stack}>
          {LAYERS.map((layer, i) => (
            <div key={layer.id} className={styles.layerWrap}>
              {/* 1. 分层视差揭示 + 2. 3D 深度堆叠 */}
              <motion.div
                ref={layer.isCore ? coreRef : undefined}
                className={`${styles.layer} ${layer.isCore ? styles.core : ''} ${layer.isCore && coreInView ? styles.coreActive : ''}`}
                initial={prefersReduced ? false : { opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.8,
                  ease: [0.16, 1, 0.3, 1],
                  delay: prefersReduced ? 0 : i * STAGGER,
                }}
                style={{
                  marginLeft: `calc(${i} * var(--layer-indent))`,
                  transformPerspective: 1000,
                }}
              >
                <div className={styles.layerIndex}>0{i + 1}</div>
                <div className={styles.layerBody}>
                  <h3 className={styles.layerTitle}>{layer.title}</h3>
                  <p className={styles.layerDesc}>{layer.desc}</p>
                </div>
                {layer.isCore && <div className={styles.coreBadge}>CORE</div>}
              </motion.div>

              {/* 3. 连接线绘制 */}
              {i < LAYERS.length - 1 && (
                <motion.div
                  className={styles.connector}
                  initial={prefersReduced ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                    delay: prefersReduced ? 0 : i * STAGGER + 0.4,
                  }}
                  style={{
                    marginLeft: `calc(${i + 0.5} * var(--layer-indent))`,
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
