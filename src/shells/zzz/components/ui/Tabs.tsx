import React, { useId, useRef } from 'react';
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

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange, className = '' }) => {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const clamped = Math.max(0, Math.min(index, tabs.length - 1));
    tabRefs.current[clamped]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(tabs[nextIndex].id);
    focusTab(nextIndex);
  };

  return (
    <div className={`${styles.tabs} ${className}`} role="tablist">
      {tabs.map((tab, index) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            id={`${baseId}-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`${styles.tab} ${isActive ? styles['tab--active'] : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
