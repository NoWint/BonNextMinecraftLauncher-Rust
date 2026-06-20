import React from 'react';
import { Icon } from './Icon';
import styles from './Inputs.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const TextInput: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <input className={`${styles.textInput} ${className}`} {...props} />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ options, className = '', ...props }) => (
  <select className={`${styles.select} ${className}`} {...props}>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

interface ToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ on, onChange, className = '' }) => (
  <button
    type="button"
    className={`${styles.toggle} ${on ? styles['toggle--on'] : styles['toggle--off']} ${className}`}
    onClick={() => onChange(!on)}
    role="switch"
    aria-checked={on}
  >
    <div className={styles.toggle__thumb} />
  </button>
);

interface CheckboxProps {
  on: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ on, onChange, className = '' }) => (
  <button
    type="button"
    className={`${styles.checkbox} ${on ? styles['checkbox--on'] : styles['checkbox--off']} ${className}`}
    onClick={() => onChange(!on)}
    role="checkbox"
    aria-checked={on}
  >
    {on && <Icon name="check" size={12} />}
  </button>
);

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  gradient?: boolean;
}

function getSliderColor(pct: number): string {
  if (pct <= 50) {
    const t = pct / 50;
    const r = Math.round(0 + t * 255);
    const g = Math.round(255 - t * 25);
    return `rgb(${r}, ${g}, 0)`;
  } else {
    const t = (pct - 50) / 50;
    const g = Math.round(230 - t * 140);
    return `rgb(255, ${g}, 0)`;
  }
}

export const Slider: React.FC<SliderProps> = ({ value, min, max, step = 1, onChange, className = '', gradient }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const pct = ((value - min) / (max - min)) * 100;
  const fillColor = gradient ? getSliderColor(pct) : undefined;

  const snapToStep = (raw: number): number => {
    const snapped = Math.round((raw - min) / step) * step + min;
    return Math.max(min, Math.min(max, parseFloat(snapped.toFixed(10))));
  };

  const calcValue = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onChange(snapToStep(min + ratio * (max - min)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    calcValue(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      if (dragging.current) calcValue(ev.clientX);
    };
    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div ref={trackRef} className={`${styles.slider} ${className}`} onMouseDown={handleMouseDown}>
      <div className={styles.slider__fill} style={{ width: `${pct}%`, background: fillColor }} />
      <div className={styles.slider__thumb} style={{ left: `${pct}%` }} />
    </div>
  );
};
