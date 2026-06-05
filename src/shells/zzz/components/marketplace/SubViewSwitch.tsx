import type { SubView, ViewMode } from './types';
import { Icon } from '../ui/Icon';
import styles from './SubViewSwitch.module.css';

interface SubViewSwitchProps {
  subView: SubView;
  viewMode: ViewMode;
  onSubViewChange: (view: SubView) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function SubViewSwitch({ subView, viewMode, onSubViewChange, onViewModeChange }: SubViewSwitchProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button
          className={`${styles.switchBtn} ${subView === 'discover' ? styles['switchBtn--active'] : ''}`}
          onClick={() => onSubViewChange('discover')}
        >
          <Icon name="sparkles" size={14} /> Discover
        </button>
        <button
          className={`${styles.switchBtn} ${subView === 'results' ? styles['switchBtn--active'] : ''}`}
          onClick={() => onSubViewChange('results')}
        >
          <Icon name="clipboard" size={14} /> Results
        </button>
      </div>
      <div className={styles.right}>
        {subView === 'results' && (
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles['viewBtn--active'] : ''}`}
              onClick={() => onViewModeChange('grid')}
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles['viewBtn--active'] : ''}`}
              onClick={() => onViewModeChange('list')}
            >
              <Icon name="list" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
