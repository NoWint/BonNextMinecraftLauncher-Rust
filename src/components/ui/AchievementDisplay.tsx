import { useState, useEffect, useCallback } from 'react';
import { getAchievements, checkAchievements } from '../../api/system';
import { Button } from './Button';
import { formatDate } from '../../shared/utils/format';
import styles from './AchievementDisplay.module.css';

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
  icon: string;
  rarity: string;
}

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

const RARITY_COLORS: Record<string, string> = {
  common: 'var(--color-text-secondary)',
  rare: '#4FC3F7',
  epic: '#BA68C8',
  legendary: '#FFD54F',
};

export default function AchievementDisplay() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const loadAchievements = useCallback(async () => {
    try {
      const list = await getAchievements();
      setAchievements(list);
    } catch {
      /* empty */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      await checkAchievements();
      await loadAchievements();
    } catch {
      /* empty */
    }
    setChecking(false);
  }, [loadAchievements]);

  const filtered = achievements.filter((a) => {
    if (filter === 'unlocked') return a.unlocked;
    if (filter === 'locked') return !a.unlocked;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0);
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  if (loading) {
    return <div className={styles.loading}>Loading achievements...</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Achievements</span>
          <span className={styles.count}>
            {unlockedCount}/{achievements.length}
          </span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.filterGroup}>
            {(['all', 'unlocked', 'locked'] as const).map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={handleCheck} disabled={checking}>
            {checking ? 'Checking...' : 'Check'}
          </Button>
        </div>
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0}%` }}
          />
        </div>
        <span className={styles.progressText}>
          {achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0}%
        </span>
      </div>

      <div className={styles.grid}>
        {sorted.map((a) => (
          <div key={a.id} className={`${styles.card} ${a.unlocked ? styles.cardUnlocked : styles.cardLocked}`}>
            <div className={styles.cardIcon}>{a.icon}</div>
            <div className={styles.cardInfo}>
              <div
                className={styles.cardName}
                style={{
                  color: a.unlocked
                    ? RARITY_COLORS[a.rarity] || 'var(--color-text-secondary)'
                    : 'var(--color-text-dim)',
                }}
              >
                {a.name}
              </div>
              <div className={styles.cardDesc}>{a.description}</div>
              {a.unlocked && a.unlocked_at && <div className={styles.cardDate}>{formatDate(a.unlocked_at)}</div>}
            </div>
            <div
              className={styles.cardRarity}
              style={{ color: RARITY_COLORS[a.rarity] || 'var(--color-text-secondary)' }}
            >
              {(a.rarity || 'common').toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
