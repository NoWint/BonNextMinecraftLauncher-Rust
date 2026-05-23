import { CONTENT_TYPE_TABS, type ContentType } from './types';
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
          <span className={styles.tab__icon}>{tab.icon}</span>
          <span className={styles.tab__label}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
