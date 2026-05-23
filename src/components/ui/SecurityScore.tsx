import styles from './SecurityScore.module.css';

interface SecurityScoreProps {
  score: number;
}

export default function SecurityScore({ score }: SecurityScoreProps) {
  const level = score <= 40 ? 'danger' : score <= 70 ? 'warning' : 'safe';
  const label = score <= 40 ? '危险' : score <= 70 ? '警告' : '安全';

  return (
    <div className={styles.container}>
      <div className={`${styles.ring} ${styles[`ring--${level}`]}`}>
        <span className={styles.score}>{score}</span>
      </div>
      <span className={`${styles.label} ${styles[`label--${level}`]}`}>{label}</span>
    </div>
  );
}
