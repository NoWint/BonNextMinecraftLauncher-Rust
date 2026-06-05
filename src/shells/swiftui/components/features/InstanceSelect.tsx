import { useState } from 'react';
import { ChevronIcon } from '../icons';
import styles from './InstanceSelect.module.css';

interface Instance { id: string; name: string; version_id: string; loader?: string; }
interface InstanceSelectProps { instances: Instance[]; selectedId?: string; onSelect: (id: string) => void; }

export function InstanceSelect({ instances, selectedId, onSelect }: InstanceSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = instances.find((i) => i.id === selectedId);
  return (
    <div className={styles.select}>
      <div className={styles.trigger} onClick={() => setOpen(!open)}>
        {selected ? (<><span className={styles.instanceName}>{selected.name}</span><span className={styles.instanceVersion}>{selected.version_id}</span></>) : <span className={styles.instanceName}>Select instance</span>}
        <ChevronIcon size={12} direction={open ? 'up' : 'down'} />
      </div>
      {open && (
        <div className={styles.dropdown}>
          {instances.map((inst) => (
            <div key={inst.id} className={styles.option} onClick={() => { onSelect(inst.id); setOpen(false); }}>
              <span className={styles.instanceName}>{inst.name}</span>
              <span className={styles.instanceVersion}>{inst.version_id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
