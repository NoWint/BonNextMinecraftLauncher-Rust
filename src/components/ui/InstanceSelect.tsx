import { useState, useRef, useEffect } from 'react';
import { type GameInstance } from '../../api';
import { Icon } from './Icon';
import { Badge } from './Status';
import styles from './InstanceSelect.module.css';

interface InstanceSelectProps {
  value: string;
  onChange: (instanceId: string) => void;
  instances: GameInstance[];
  filterVersion?: string;
  filterLoader?: string;
}

function getLoaderLabel(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return 'Fabric';
    case 'forge':
      return 'Forge';
    default:
      return 'Vanilla';
  }
}

export function InstanceSelect({ value, onChange, instances, filterVersion, filterLoader }: InstanceSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = instances.filter((inst) => {
    if (filterVersion && inst.version_id !== filterVersion) return false;
    if (filterLoader && inst.loader_type !== filterLoader) return false;
    return true;
  });

  const selected = instances.find((i) => i.id === value);

  return (
    <div className={styles.select} ref={ref}>
      <button type="button" className={styles.select__trigger} onClick={() => setOpen(!open)}>
        <div className={styles.select__icon}>
          {selected?.loader_type === 'fabric'
            ? '\u{1F9F5}'
            : selected?.loader_type === 'forge'
              ? '\u{2692}'
              : '\u{1F4E6}'}
        </div>
        <div className={styles.select__info}>
          <span className={styles.select__name}>{selected?.name || 'Select instance...'}</span>
          {selected && (
            <>
              <Badge variant="accent">{selected.version_id}</Badge>
              <Badge variant="muted">{getLoaderLabel(selected.loader_type)}</Badge>
            </>
          )}
        </div>
        <span className={styles.select__arrow}>
          {open ? <Icon name="chevronUp" size={10} /> : <Icon name="chevronDown" size={10} />}
        </span>
      </button>

      <div className={`${styles.select__dropdown} ${open ? styles['select__dropdown--open'] : ''}`}>
        {filtered.length === 0 ? (
          <div className={styles.select__empty}>No matching instances</div>
        ) : (
          filtered.map((inst) => (
            <div
              key={inst.id}
              className={`${styles.select__option} ${inst.id === value ? styles['select__option--active'] : ''}`}
              onClick={() => {
                onChange(inst.id);
                setOpen(false);
              }}
            >
              {inst.name}
              <span style={{ marginLeft: 8 }}>
                <Badge variant="accent">{inst.version_id}</Badge>
                <Badge variant="muted">{getLoaderLabel(inst.loader_type)}</Badge>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
