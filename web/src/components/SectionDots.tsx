import styles from './SectionDots.module.css';

interface SectionDotsProps {
  sections: Array<{ id: string; label: string }>;
}

export function SectionDots({ sections }: SectionDotsProps) {
  return (
    <div className={styles.dots} aria-label="章节导航">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={styles.dot}
          aria-label={s.label}
          title={s.label}
        />
      ))}
    </div>
  );
}
