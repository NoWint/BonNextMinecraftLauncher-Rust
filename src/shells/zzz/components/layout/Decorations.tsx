import React from 'react';
import styles from './Decorations.module.css';

interface HeadingProps {
  level?: 'xl' | 'lg' | 'md';
  /** 语义化层级,默认 h2。设为 0 时渲染为 div(仅装饰用途) */
  headingLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: React.ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({ level = 'xl', headingLevel = 2, className = '', children }) => {
  const cls = `${styles.heading} ${styles[`heading--${level}`]} ${className}`;
  if (headingLevel === 0) return <div className={cls}>{children}</div>;
  const Tag = `h${headingLevel}` as keyof React.JSX.IntrinsicElements;
  return <Tag className={cls}>{children}</Tag>;
};

interface SubLabelProps {
  className?: string;
  children: React.ReactNode;
}

export const SubLabel: React.FC<SubLabelProps> = ({ className = '', children }) => (
  <div className={`${styles.subLabel} ${className}`}>{children}</div>
);

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, className = '' }) => (
  <div className={`${styles.sectionHeader} ${className}`}>
    <div className={styles.sectionHeader__bar} />
    <span className={styles.sectionHeader__title}>{title}</span>
    {subtitle && (
      <>
        <div className={styles.sectionHeader__separator} />
        <span className={styles.sectionHeader__subtitle}>{subtitle}</span>
      </>
    )}
  </div>
);

interface DividerProps {
  variant?: 'section' | 'highlight' | 'subtle';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ variant = 'section', className = '' }) => (
  <div className={`${styles.divider} ${styles[`divider--${variant}`]} ${className}`} />
);

interface AccentCornerProps {
  position: 'topRight' | 'bottomLeft' | 'topLeft';
  className?: string;
}

export const AccentCorner: React.FC<AccentCornerProps> = ({ position, className = '' }) => (
  <div className={`${styles.accentCorner} ${styles[`accentCorner--${position}`]} ${className}`} />
);

interface TickerProps {
  messages: string[];
  className?: string;
}

export const Ticker: React.FC<TickerProps> = ({ messages, className = '' }) => (
  <div className={`${styles.ticker} ${className}`} role="marquee" aria-live="off">
    <div className={styles.ticker__label}>NEWS</div>
    <div className={styles.ticker__content}>
      {messages.map((msg, i) => (
        <React.Fragment key={i}>
          <span>{msg}</span>
          {i < messages.length - 1 && <div className={styles.ticker__dot} />}
        </React.Fragment>
      ))}
    </div>
  </div>
);
