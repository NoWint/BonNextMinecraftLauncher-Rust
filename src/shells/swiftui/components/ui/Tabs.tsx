import { useState, type ReactNode } from 'react';
import styles from './Tabs.module.css';

interface Tab { id: string; label: string; content?: ReactNode; }
interface TabsProps { tabs: Tab[]; defaultTab?: string; onChange?: (tabId: string) => void; }

export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const handleTabClick = (tabId: string) => { setActiveTab(tabId); onChange?.(tabId); };
  const activeContent = tabs.find((t) => t.id === activeTab)?.content;
  return (
    <div className={styles.container}>
      <div className={`${styles.segmentedControl} glass-thin`} role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`} onClick={() => handleTabClick(tab.id)} role="tab" aria-selected={activeTab === tab.id}>{tab.label}</button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel" key={activeTab}>{activeContent}</div>
    </div>
  );
}
