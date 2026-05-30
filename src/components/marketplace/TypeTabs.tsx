import { CONTENT_TYPE_TABS, type ContentType } from './types';
import { Icon } from '../ui/Icon';
import styles from './TypeTabs.module.css';

interface TypeTabsProps {
  activeTab: ContentType;
  onTabChange: (tab: ContentType) => void;
}

export default function TypeTabs({ activeTab, onTabChange }: TypeTabsProps) {
  return (
    <div className={styles.tabs}>
      {CONTENT_TYPE_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles['tab--active'] : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.tab__icon}>
            <Icon name={tab.icon} size={14} />
          </span>
          <span className={styles.tab__label}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
