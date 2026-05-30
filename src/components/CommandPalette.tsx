import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ui/Icon';
import styles from './CommandPalette.module.css';

interface Command {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

function useCommands() {
  const navigate = useNavigate();
  return [
    {
      id: 'home',
      label: 'Home',
      description: 'Go to dashboard',
      shortcut: 'Ctrl+H',
      category: 'Navigation',
      action: () => navigate('/home'),
    },
    {
      id: 'instances',
      label: 'Instances',
      description: 'Manage instances',
      shortcut: 'Ctrl+I',
      category: 'Navigation',
      action: () => navigate('/instances'),
    },
    {
      id: 'mods',
      label: 'Mod Browser',
      description: 'Browse and install mods',
      shortcut: 'Ctrl+M',
      category: 'Navigation',
      action: () => navigate('/mods'),
    },
    {
      id: 'versions',
      label: 'Versions',
      description: 'Browse Minecraft versions',
      shortcut: 'Ctrl+V',
      category: 'Navigation',
      action: () => navigate('/versions'),
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure launcher',
      shortcut: 'Ctrl+,',
      category: 'Navigation',
      action: () => navigate('/settings'),
    },
    {
      id: 'new-instance',
      label: 'New Instance',
      description: 'Create a new game instance',
      shortcut: 'Ctrl+N',
      category: 'Instance',
      action: () => navigate('/instances/new'),
    },
    {
      id: 'quick-start',
      label: 'Quick Start',
      description: 'Launch latest version instantly',
      category: 'Game',
      action: () => {},
    },
  ];
}

export function CommandPalette() {
  const COMMANDS = useCommands();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()),
      )
    : COMMANDS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const executeCommand = useCallback((cmd: Command) => {
    setOpen(false);
    setQuery('');
    setTimeout(() => cmd.action(), 50);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      executeCommand(filtered[selectedIdx]);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <span className={styles.searchIcon}>
            <Icon name="command" size={14} />
          </span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.hint}>esc</span>
        </div>
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`${styles.item} ${i === selectedIdx ? styles['item--active'] : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <div className={styles.itemLeft}>
                  <span className={styles.itemLabel}>{cmd.label}</span>
                  <span className={styles.itemCategory}>{cmd.category}</span>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemDesc}>{cmd.description}</span>
                  {cmd.shortcut && <span className={styles.itemShortcut}>{cmd.shortcut}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
