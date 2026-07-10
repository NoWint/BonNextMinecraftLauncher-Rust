import { useState, useRef, useEffect } from 'react';
import { useShellStore } from '../stores/shellStore';
import styles from './ShellSwitcher.module.css';

const SHELL_ICONS: Record<string, JSX.Element> = {
  zzz: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 10L6 6H4.5M8 10L10 6H8.5M11.5 10L13.5 6H12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  swiftui: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
  editor: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5h8M4 8h6M4 11h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
};

/** Default icon for custom shells */
const CustomShellIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
    <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 12 12" fill="none" className={className} width="10" height="10">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" width="12" height="12" className={styles.shellItemCheck}>
    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ShellSwitcher() {
  const { state, setActiveShell } = useShellStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeShell = state.availableShells.find((s) => s.id === state.activeShell);
  const activeIcon = activeShell
    ? (SHELL_ICONS[activeShell.id] || (activeShell.isCustom ? <CustomShellIcon /> : null))
    : null;

  const handleSelect = async (shellId: string) => {
    if (shellId === state.activeShell) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await setActiveShell(shellId);
  };

  return (
    <div className={styles.shellSwitcher} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} title="Switch Shell">
        {activeIcon}
        <span>{activeShell?.name || 'Shell'}</span>
        <ChevronIcon className={`${styles.triggerChevron} ${open ? styles.triggerChevronOpen : ''}`} />
      </button>

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            {state.availableShells.map((shell) => {
              const isActive = shell.id === state.activeShell;
              const icon = SHELL_ICONS[shell.id] || (shell.isCustom ? <CustomShellIcon /> : <span className={styles.shellItemIcon} />);
              return (
                <button
                  key={shell.id}
                  className={`${styles.shellItem} ${isActive ? styles.shellItemActive : ''}`}
                  onClick={() => handleSelect(shell.id)}
                >
                  {icon}
                  <div className={styles.shellItemInfo}>
                    <span className={styles.shellItemName}>
                      {shell.name}
                      {shell.isCustom && <span className={styles.customBadge}>Custom</span>}
                    </span>
                    <span className={styles.shellItemDesc}>{shell.description}</span>
                  </div>
                  {isActive && <CheckIcon />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
