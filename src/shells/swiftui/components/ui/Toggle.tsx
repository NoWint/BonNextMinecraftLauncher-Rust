import styles from './Toggle.module.css';

interface ToggleProps { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; id?: string; }

export function Toggle({ checked, onChange, disabled = false, id }: ToggleProps) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.toggleDisabled : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} id={id} role="switch" aria-checked={checked} className={styles.input} />
      <span className={`${styles.track} ${checked ? styles.trackOn : styles.trackOff}`} />
      <span className={`${styles.thumb} ${checked ? styles.thumbOn : ''}`} />
    </label>
  );
}
