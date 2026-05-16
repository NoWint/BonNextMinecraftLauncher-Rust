import React from 'react';
import styles from './Tabs.module.css';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange, className = '' }) => (
  <div className={`${styles.tabs} ${className}`}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        className={`${styles.tab} ${activeId === tab.id ? styles['tab--active'] : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
